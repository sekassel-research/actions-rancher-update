# rancher-update

This action helps by updating a service in the rancher 1.6.x environment. 

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
      - uses: sekassel-research/actions-rancher-update@v1
        with:
          rancher_url: https://rancher.test.de
          rancher_access: ${{ secrets.RANCHER_ACCESS }}
          rancher_key: ${{ secrets.RANCHER_KEY }}
          project_id: 1a5
          stack_name: test-stack
          service_name: test-service
          docker_image: sekassel-research/test-image:latest
          retry_count: 10 # optional
          retry_delay: 5 # optional
```

This will upgrade the service in Rancher and wait 5 seconds before
trying to finish the upgrade. The action will wait 10 times before
failing the job, if the upgrade is not successful.
