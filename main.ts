import * as core from '@actions/core';
import {HttpClient} from '@actions/http-client';
import {TypedResponse} from '@actions/http-client/lib/interfaces';

async function main() {
  const rancherUrl = core.getInput('rancher_url', {required: true});
  const rancherToken = core.getInput('rancher_token', {required: true});
  const clusterId = core.getInput('cluster_id', {required: true});
  const namespace = core.getInput('namespace', {required: true});
  const workloads = core.getInput('workloads', {required: true});
  const dockerImage = core.getInput('docker_image', {required: true});
  const redeploy = core.getBooleanInput('redeploy', {required: false});

  const parsedWorkloads: {apiVersion: string; kind: string, name: string, containerPath: string}[] = [];
  for (const line of workloads.split(/[\s,]+/)) {
    if (!line) {
      continue; // skip empty items
    }

    // kind/workload[/containerId]
    const [kind, workload, containerId = '0'] = line.split('/');
    if (!kind || !workload) {
      fail(`Invalid workload format: ${line}. Expected format: kind/workload[/containerId]`);
      return;
    }
    const apiVersion = getApiVersion(kind);
    const containerPath = getContainerImagePath(kind, containerId);
    parsedWorkloads.push({apiVersion, kind, name: workload, containerPath});
  }

  const http = new HttpClient('actions-rancher-update', undefined, {
    headers: {
      Authorization: `Bearer ${rancherToken}`,
    },
  });

  const results = await Promise.allSettled(parsedWorkloads.map(async workload => {
    const patches = [
      {
        op: 'replace',
        path: workload.containerPath,
        value: dockerImage,
      },
    ];

    // Similar to rancher, we ensure the pods are redeployed by adding a timestamp annotation to the spec.
    const annotationsPath = getAnnotationsPath(workload.kind);
    if (redeploy && annotationsPath) {
      patches.push({
        op: 'add',
        // https://stackoverflow.com/questions/55573724/create-a-patch-to-add-a-kubernetes-annotation
        path: annotationsPath + '/cattle.io~1timestamp',
        value: new Date().toISOString(),
      });
    }

    console.log(`Updating ${workload.kind} ${workload.name} in namespace ${namespace} with image ${dockerImage}...`);
    const patchResponse = await http.patchJson(
      `${rancherUrl}/k8s/clusters/${clusterId}/apis/${workload.apiVersion}/namespaces/${namespace}/${workload.kind}s/${workload}`,
      patches,
      {
        // NB: must be lowercase, otherwise patchJson overrides this with 'application/json'
        'content-type': 'application/json-patch+json',
      },
    );
    if (isOk(patchResponse)) {
      console.log(`Patched ${workload.kind} ${workload.name}.`);
    } else {
      throw new Error(`Failed to patch ${workload.kind} ${workload.name}: ${patchResponse.statusCode} ${JSON.stringify(patchResponse.result)}`);
    }
  }));

  if (results.some(result => result.status === 'rejected')) {
    fail(`Some workloads failed to update:\n${results
      .filter(result => result.status === 'rejected')
      .map(result => '- ' + result.reason).join('\n')
    }`);
  }
}

function getApiVersion(kind: string) {
  switch (kind) {
    // https://kubernetes.io/docs/concepts/workloads/controllers/
    case 'deployment':
    case 'statefulset':
    case 'daemonset':
    case 'replicaset':
    case 'replicationcontroller':
      return 'apps/v1';
    case 'job':
    case 'cronjob':
      return 'batch/v1';
    default:
      throw new Error(`Unsupported workload kind: ${kind}`);
  }
}

function getContainerImagePath(kind: string, containerId: string) {
  switch (kind) {
    // https://kubernetes.io/docs/concepts/workloads/controllers/
    case 'deployment':
    case 'statefulset':
    case 'daemonset':
    case 'replicaset':
    case 'replicationcontroller':
    case 'job':
      return `/spec/template/spec/containers/${containerId}/image`;
    case 'cronjob':
      return `/spec/jobTemplate/spec/template/spec/containers/${containerId}/image`;
    default:
      throw new Error(`Unsupported workload kind: ${kind}`);
  }
}

function getAnnotationsPath(kind: string) {
  switch (kind) {
    case 'deployment':
    case 'statefulset':
    case 'daemonset':
    case 'replicaset':
    case 'replicationcontroller':
      return `/spec/template/metadata/annotations`;
  }
}

function isOk(result: TypedResponse<unknown>) {
  return result.statusCode >= 200 && result.statusCode < 300;
}

function fail(message: string, ...args: any[]) {
  console.error(message, ...args);
  core.setFailed(message);
}

function handleError(err: Error) {
  console.error(err);
  core.setFailed(err.message);
}

process.on('unhandledRejection', handleError);
main().catch(handleError);
