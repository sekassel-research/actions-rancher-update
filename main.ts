import * as core from '@actions/core';
import {HttpClient} from '@actions/http-client';

process.on('unhandledRejection', handleError);
main().catch(handleError);

async function main() {
  const rancherUrl = core.getInput('rancher_url', {required: true});
  const rancherToken = core.getInput('rancher_token', {required: true});
  const clusterId = core.getInput('cluster_id', {required: true});
  const projectId = core.getInput('project_id', {required: true});
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

  const path = getContainerImagePath(kind, containerId);

  const http = new HttpClient('actions-rancher-update', undefined, {
    headers: {
      Authorization: `Bearer ${rancherToken}`,
    },
  });

  await http.patchJson(
    `${rancherUrl}/k8s/clusters/${clusterId}/apis/apps/v1/namespaces/${namespace}/${kind}s/${workload}`,
    [
      {
        op: 'replace',
        path,
        value: dockerImage,
      },
    ],
    {
      'Content-Type': 'application/json-patch+json',
    },
  );

  await http.postJson(
    `${rancherUrl}/v3/projects/${clusterId}:${projectId}/workloads/${kind}:${namespace}:${deployment}?action=redeploy`,
    {},
  );
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

function handleError(err: Error) {
  console.log(err);
  core.setFailed(err.message);
}
