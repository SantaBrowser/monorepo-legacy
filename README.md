
### Usage

Run in this order as apps depend on eachother and will fail if services are not fully started.

install node version 16.14.0


```bash
cd certs
openssl req -x509 -sha256 -nodes -newkey rsa:2048 -days 365 -keyout localhost.key -out localhost.crt
cd ..
yarn
yarn serve:dashboard
yarn serve:public
```

copy certs files in the certs folder in monorepo
