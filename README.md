# rancher-update

This action helps by updating a service in the Rancher 2 environment with kubernetes.
It does so by patching the container `image` field of one or more deployments, cronjobs, statefulsets, etc.
In addition, it sets a timestamp annotation to ensure redeployment.

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
    - uses: sekassel-research/actions-rancher-update@v4.0.0
      with:
        rancher_url: ${{ secrets.RANCHER_URL }} # e.g. https://rancher.test.de
        rancher_token: ${{ secrets.RANCHER_TOKEN }} # e.g. token-xxxxx:xxxxxxxxxxxxxxx
        cluster_id: ${{ secrets.CLUSTER_ID }} # e.g. c-xxxxx
        namespace: ${{ secrets.NAMESPACE }}
        # Update one or more workloads. Optionally supports container ID.
        workloads: |
          deployment/${{ secrets.DEPLOYMENT }}
          cronjob/${{ secrets.CRONJOB }}
          deployment/${{ secrets.DEPLOYMENT }}/2
        docker_image: sekassel-research/example:latest
```

# Backwards compatibility

If you want to use this extension for Rancher 1.6.x, please read the instructions on the [v1 branch](https://github.com/sekassel-research/actions-rancher-update/tree/v1#readme).
