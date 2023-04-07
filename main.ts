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
  const deployment = core.getInput('deployment', {required: true});
  const dockerImage = core.getInput('docker_image', {required: true});
  const containerId = core.getInput('container_id', {required: false}) || 0;

  const http = new HttpClient('actions-rancher-update', undefined, {
    headers: {
      Authorization: `Bearer ${rancherToken}`,
    },
  });

  await http.patchJson(
    `${rancherUrl}/k8s/clusters/${clusterId}/apis/apps/v1/namespaces/${namespace}/deployments/${deployment}`,
    [
      {
        op: 'replace',
        path: `/spec/template/spec/containers/${containerId}/image`,
        value: dockerImage,
      },
    ],
    {
      'Content-Type': 'application/json-patch+json',
    },
  );

  await http.postJson(
    `${rancherUrl}/v3/projects/${clusterId}:${projectId}/workloads/deployment:${namespace}:${deployment}?action=redeploy`,
    {},
  );
}

function handleError(err: Error) {
  console.log(err);
  core.setFailed(err.message);
}
