const core = require('@actions/core');
const request = require('request-promise-native');

process.on('unhandledRejection', handleError);
main().catch(handleError);

const sleep = (sec) => new Promise((resolve) => setTimeout(resolve, sec * 1000));
const waitForState = async (waitFor, rancherApi, id) => {
  let retry = 120;
  let state = '';
  while (state !== waitFor && retry > 0) {
    state = (await rancherApi.get(`/services/${id}`)).state;
    retry--;
    await sleep(1);
  }

  if (retry === 0) {
    throw new Error(`Maximum retries exceeded waiting for state ${waitFor}`);
  }
}

async function main() {
  const RANCHER_URL = core.getInput('rancher_url', { required: true });
  const RANCHER_ACCESS = core.getInput('rancher_access', { required: true });
  const RANCHER_KEY = core.getInput('rancher_key', { required: true });
  const PROJECT_ID = core.getInput('project_id', { required: true });
  const STACK_NAME = core.getInput('stack_name', { required: true });
  const SERVICE_NAME = core.getInput('service_name', { required: true });
  const DOCKER_IMAGE = core.getInput('docker_image', { required: true });
 
  const rancherApi = request.defaults({
    baseUrl: `${RANCHER_URL}/v2-beta/projects/${PROJECT_ID}`,
    auth: {
      user: RANCHER_ACCESS,
      pass: RANCHER_KEY
    },
    json: true
  });

  let success = false;
  // Check the stack
  const stack = await rancherApi.get(`/stacks?name=${STACK_NAME}`);
  if (!stack || !stack.data[0]) {
    throw new Error('Could not find stack name. Check the stack_name input. Deploy failed!');
  }
  const stackId = stack.data[0].id;

  // Check the service
  const service = await rancherApi.get(`/services?name=${SERVICE_NAME}&stackId=${stackId}`);
  if (!service || !service.data[0]) {
    throw new Error('Could not find service name. Check the service_name input. Deploy failed!');
  }
  const { id, launchConfig } = service.data[0];
  launchConfig.imageUuid = `docker:${DOCKER_IMAGE}`;

  // Upgrade
  const body = {
    inServiceStrategy: {
      launchConfig
    }
  };
  await rancherApi.post(`/service/${id}?action=upgrade`, { body });
  console.log('Waiting for upgrade ...');
  await waitForState('upgraded', rancherApi, id);

  // Finish upgrade
  await rancherApi.post(`/service/${id}?action=finishupgrade`);
  console.log('Waiting for service starting ...');
  await waitForState('active', rancherApi, id);

  console.log('Service is running, upgrade successful');
  core.setOutput('result', success);
}

function handleError(err) {
  console.log(err);
  core.setFailed(err.message);
}