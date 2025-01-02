# rancher-update

This action helps by updating a service in the Rancher 2 environment with kubernetes. 

# Examples

## Update service

```yaml
on:
push:
  branches:
  - master

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
    - uses: sekassel-research/actions-rancher-update@v3.2.0
      with:
        rancher_url: ${{ secrets.RANCHER_URL }} # e.g. https://rancher.test.de
        rancher_token: ${{ secrets.RANCHER_TOKEN }} # e.g. token-xxxxx:xxxxxxxxxxxxxxx
        cluster_id: ${{ secrets.CLUSTER_ID }} # e.g. c-xxxxx
        namespace: ${{ secrets.NAMESPACE }}
        kind: deployment # e.g. deployment (default), statefulset, cronjob
        workload: ${{ secrets.WORKLOAD }} # e.g. my-service
        deployment: ${{ secrets.DEPLOYMENT }} # deprecated, use workload instead
        docker_image: sekassel-research/example:latest
        container_id: 0 # optional, defaults to 0
```

# Backwards compatibility

If you want to use this extension for Rancher 1.6.x, please read the instructions on the [v1 branch](https://github.com/sekassel-research/actions-rancher-update/tree/v1#readme).
