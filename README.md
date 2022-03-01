NOTE: NOT SURE WHETHER THE CHANGE TO HEADER FORWARDING IS STILL NECESSARY
## Enable Header Forwarding in CloudFront
Select the CloudFront distribution that’s associated with the S3 bucket you changed above in the AWS console. Click Distribution Settings. Go to the Behaviours tab, click the behaviour (if you have more than one, you’ll need to do the following for all of them) and click Edit. Change the Forward Headers dropdown to Whitelist. Select ‘Origin’ in the left-hand list and click Add to move it to the right-hand list. Click Yes, Edit to save and then wait for CloudFront to propagate the change; about 20 mins to half an hour.

## Need to config "Edit behavior" -> "Restricted Viewer Access" on CloudFront
1. Create a Public Key by using the content of the private key file created in "IAM" -> "Security Credentials" -> CloudFront Key Pairs
2. Create a Key Group and the publick key created above

3. "Edit behavior" -> "Restricted Viewer Access" =YES -> Trusted Key Groups -> Select the Key Group in step 2

## make sure we have CLOUDFRONT_PUBLIC_KEY and CLOUD_FRONT_PRIVATE_KEY in Secrets Manager

CLOUDFRONT_PUBLIC_KEY: this use the key created in Public Key
CLOUD_FRONT_PRIVATE_KEY: this use the private key from   "IAM" -> "Security Credentials" -> CloudFront Key Pairs

## "The bucket does not allow ACLs" Error
If you run into "The bucket does not allow ACLs" error when uploading the file
Go to the "Edit Object Ownership" page of S3 bucket settings from the url below
https://s3.console.aws.amazon.com/s3/bucket/bandup-us-prod-document/property/oo/edit?region=us-east-1
Enable ACL