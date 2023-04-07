const core = require('@actions/core');
const {HttpClient} = require('@actions/http-client');

process.on('unhandledRejection', handleError);
main().catch(handleError);

const sleep = (sec) => new Promise((resolve) => setTimeout(resolve, sec * 1000));
const waitForState = async (waitFor, http, baseUrl, id, retryCount, retryDelay) => {
  let state = '';
  while (state !== waitFor && retryCount > 0) {
    state = (await http.getJson(`${baseUrl}/services/${id}`)).result.state;
    retryCount--;
    await sleep(retryDelay);
  }

  if (retryCount === 0) {
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
  const RETRY_COUNT = +core.getInput('retry_count');
  const RETRY_DELAY = +core.getInput('retry_delay');

  const http = new HttpClient('actions-rancher-deploy', undefined, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${RANCHER_ACCESS}:${RANCHER_KEY}`).toString('base64')}`
    }
  });
  const baseUrl = `${RANCHER_URL}/v2-beta/projects/${PROJECT_ID}`;

  let success = false;
  // Check the stack
  const {result: stack} = await http.getJson(`${baseUrl}/stacks?name=${STACK_NAME}`);
  if (!stack || !stack.data[0]) {
    throw new Error('Could not find stack name. Check the stack_name input. Deploy failed!');
  }
  const stackId = stack.data[0].id;

  // Check the service
  const {result: service} = await http.getJson(`${baseUrl}/services?name=${SERVICE_NAME}&stackId=${stackId}`);
  if (!service || !service.data[0]) {
    throw new Error('Could not find service name. Check the service_name input. Deploy failed!');
  }
  const { id, launchConfig } = service.data[0];
  launchConfig.imageUuid = `docker:${DOCKER_IMAGE}`;

  // Upgrade
  await http.postJson(`${baseUrl}/service/${id}?action=upgrade`, {
    inServiceStrategy: {
      launchConfig
    }
  });
  console.log('Waiting for upgrade ...');
  await waitForState('upgraded', http, id, RETRY_COUNT, RETRY_DELAY);

  // Finish upgrade
  await http.post(`${baseUrl}/service/${id}?action=finishupgrade`, '');
  console.log('Waiting for service starting ...');
  await waitForState('active', http, id, RETRY_COUNT, RETRY_DELAY);

  console.log('Service is running, upgrade successful');
  core.setOutput('result', success);
}

function handleError(err) {
  console.log(err);
  core.setFailed(err.message);
}
