import * as core from '@actions/core';
import {HttpClient} from '@actions/http-client';
import {TypedResponse} from '@actions/http-client/lib/interfaces';

async function main() {
  const rancherUrl = core.getInput('rancher_url', {required: true});
  const rancherToken = core.getInput('rancher_token', {required: true});
  const clusterId = core.getInput('cluster_id', {required: true});
  const namespace = core.getInput('namespace', {required: true});
  const kind = core.getInput('kind', {required: false})?.toLowerCase() || 'deployment';
  let workload = core.getInput('workload', {required: false});
  const deployment = core.getInput('deployment', {required: false});
  const dockerImage = core.getInput('docker_image', {required: true});
  const containerId = core.getInput('container_id', {required: false}) || '0';

  if (!workload) {
    if (!deployment) {
      throw new Error('Either workload or deployment must be provided');
    }
    workload = deployment;
    console.warn(`The 'deployment' argument is deprecated, please use \`workload: ${workload}\` instead`);
  }

  const apiVersion = getApiVersion(kind);
  const http = new HttpClient('actions-rancher-update', undefined, {
    headers: {
      Authorization: `Bearer ${rancherToken}`,
    },
  });

  const patches = [
    {
      op: 'replace',
      path: getContainerImagePath(kind, containerId),
      value: dockerImage,
    },
  ];

  // Similar to rancher, we ensure the pods are redeployed by adding a timestamp annotation to the spec.
  const annotationsPath = getAnnotationsPath(kind);
  if (annotationsPath) {
    patches.push({
      op: 'add',
      // https://stackoverflow.com/questions/55573724/create-a-patch-to-add-a-kubernetes-annotation
      path: annotationsPath + '/cattle.io~1timestamp',
      value: new Date().toISOString(),
    });
  }

  console.log(`Updating ${kind} ${workload} in namespace ${namespace} with image ${dockerImage}...`);
  const patchResponse = await http.patchJson(
    `${rancherUrl}/k8s/clusters/${clusterId}/apis/${apiVersion}/namespaces/${namespace}/${kind}s/${workload}`,
    patches,
    {
      // NB: must be lowercase, otherwise patchJson overrides this with 'application/json'
      'content-type': 'application/json-patch+json',
    },
  );
  if (isOk(patchResponse)) {
    console.log(`Patched ${kind} ${workload}.`);
  } else {
    fail(`Failed to patch ${kind} ${workload}: ${patchResponse.statusCode}`, patchResponse.result);
    return;
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
