set -e
export AWS_PROFILE=douhub-dev
sh run-tsc.sh
serverless deploy --apiName file --stage prod --accountId 110064165845 --apiDomain douhub.io --clientName douhub --resourceName bandup --region us-east-1 --roleName douhub-lambda-super -v 
