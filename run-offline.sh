set -e
export AWS_PROFILE=douhub-dev
sh run-tsc.sh
serverless offline --apiName file --stage prod --track true --accountId 110064165845 --apiDomain douhub.io --clientName douhub --resourceName bandup --region us-east-1 --roleName douhub-lambda-super -v 
