# rancher-update

This action helps by updating a service in the Rancher 2 environment with kubernetes.
It does so by patching the container `image` field of one or more deployments, cronjobs, statefulsets, etc.
In addition, it can set a timestamp annotation to ensure redeployment.

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
        redeploy: false # optional, sets a timestamp annotation to ensure redeployment
```

- Use `redeploy` if you want automatic redeployment similar to the Rancher "Redeploy" button.
  This is useful if you have a fixed tag like `latest` and not if you inject a dynamic version into the workflow.
  > [!NOTE]
  > Note that this may fail if the pod does not have an `annotations` field due to limitations of json-patch (empty object is ok).
  > See https://stackoverflow.com/a/61514294/4138801

# Backwards compatibility

If you want to use this extension for Rancher 1.6.x, please read the instructions on the [v1 branch](https://github.com/sekassel-research/actions-rancher-update/tree/v1#readme).
