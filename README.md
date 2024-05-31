
### Usage

Run in this order as apps depend on eachother and will fail if services are not fully started.

This repository requires 16.14.0.
This repository should be checkouted beside with monorepo repository

```bash
./init.sh yarn
# Terminal 1
./run.sh "yarn serve:dashboard"
# Terminal 2
./run.sh "yarn serve:public"
```