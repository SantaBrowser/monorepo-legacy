#!/bin/bash
set -xe

cp .env.example .env
cp ./apps/dashboard/.env.example ./apps/dashboard/.env

cp -a ../monorepo/certs .

./run.sh yarn
