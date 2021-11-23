1 Enable CORS on your S3 bucket
Go to your S3 bucket in the AWS (Amazon Web Services) console and select it. Click the Properties tab then open the Permissions area. You should see a button labelled ‘Edit CORS Configuration’ or something similar. Click it. You’ve now got a popup called ‘CORS Configuration Editor’ with a big text box in it. Paste your CORS config in there and press save.

Example CORS configuration

```json
<CORSConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
    <CORSRule>
        <AllowedOrigin>YOUR DOMAIN HERE</AllowedOrigin>
        <AllowedMethod>GET</AllowedMethod>
        <AllowedHeader>*</AllowedHeader>
    </CORSRule>
</CORSConfiguration>
```

This is a very basic CORS configuration for one domain. Replace ‘YOUR DOMAIN HERE’ with your domain (wildcards are allowed). Add an allowed method tag for each HTTP method you want to use (GET, POST, PUT, DELETE). There are more options available as listed at Amazon's How do I enable Cors

2: Enable Header Forwarding in CloudFront
Select the CloudFront distribution that’s associated with the S3 bucket you changed above in the AWS console. Click Distribution Settings. Go to the Behaviours tab, click the behaviour (if you have more than one, you’ll need to do the following for all of them) and click Edit. Change the Forward Headers dropdown to Whitelist. Select ‘Origin’ in the left-hand list and click Add to move it to the right-hand list. Click Yes, Edit to save and then wait for CloudFront to propagate the change; about 20 mins to half an hour.


3. Create a user with the policy

{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "DouHub",
            "Effect": "Allow",
            "Action": [
                "s3:ListBucketMultipartUploads",
                "s3:AbortMultipartUpload",
                "s3:ListMultipartUploadParts",
                "s3:PutObjectAcl",
                "s3:PutObject",
                "s3:GetObjectAcl",
                "s3:GetObject",
                "s3:DeleteObject"
            ],
            "Resource": [
                "arn:aws:s3:::douhub-us-prod-photo/*",
                "arn:aws:s3:::douhub-us-prod-document/*",
                "arn:aws:s3:::douhub-us-prod-video/*",
                "arn:aws:s3:::douhub-us-prod-audio/*"
            ]
        }
    ]
}

4. Allow client to upload file
uncheck Block public access to buckets and objects granted through new access control lists (ACLs)
uncheck Block public access to buckets and objects granted through any access control lists (ACLs)