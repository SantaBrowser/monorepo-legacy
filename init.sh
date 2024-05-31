#!/bin/bash
cp .env.localhost .env
cp ./apps/dashboard/.env.localhost ./apps/dashboard/.env
cp -a ../monorepo/certs .

./run.sh yarn
