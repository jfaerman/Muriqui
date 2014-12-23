/*
Step 1: Static Hello World on S3

                putBucketPolicy
createBucket -> putBucketWebsite
                uploadFiles -> upload index.html
                            -> upload other.html
*/
var fs = require('fs')
var AWS = require('aws-sdk'); 
var df = require('dateformat');
var now  = new Date();
var nows = df(now,"yyyy-mm-dd-hh-MM-ss") 
var rx = require("rx")

var bucketName = "muriqui-" + nows;
console.log('Starting Example '+bucketName);

var s3 = new AWS.S3();

//Create Bucket
var createBucket = rx.Observable.fromNodeCallback(s3.createBucket,s3);
var bucket = createBucket({Bucket: bucketName});

//Put Bucket Website
var putBucketWebsite = rx.Observable.fromNodeCallback(s3.putBucketWebsite,s3);
var website = putBucketWebsite({
	Bucket: bucketName,
	WebsiteConfiguration : {
		IndexDocument : {
			Suffix:"index.html"},
		ErrorDocument: {
			Key: "index.html"}
	}
});

//Make the bucket public
var putBucketPolicy = rx.Observable.fromNodeCallback(s3.putBucketPolicy,s3);
var publicPolicy = [
	'{',
	'  "Version":"2012-10-17",',
	'  "Statement":[{',
	'	 "Sid":"AddPerm",',
	'        "Effect":"Allow",',
	'	 "Principal": "*",',
	'      "Action":["s3:GetObject"],',
	'      "Resource":["arn:aws:s3:::'+bucketName+'/*"',
	'     ]',
	'    }',
	'  ]',
	'}'].join('')

var pub = putBucketPolicy({
		Bucket: bucketName,
		Policy: publicPolicy
	});

//File Uploads
var files = ["index.html","img/muriqui.jpg"];
var readFile = rx.Observable.fromNodeCallback(fs.readFile,fs)
var uploadFile = rx.Observable.fromNodeCallback(s3.putObject,s3)
var uploadFiles =  files.map(function(fileName){
	return readFile("muriqui-ui/"+fileName).flatMap(function(stream){		
		return uploadFile({
			Bucket: bucketName,
			Key:fileName,
			Body: stream,
			ContentType:"text/html"
		});
	});
})

//Compose the parallel streams
var pllUploads = rx.Observable.forkJoin(uploadFiles)
var pllTasks = rx.Observable.forkJoin(pub,website,pllUploads)

var deploy = bucket.flatMap(pllTasks);

//Subscribes to deployment steps
var subscription = deploy.subscribe (
	function(x) {
		console.log("Deployment step")
		console.log(x)
	},
	function(e) {
		console.error("Deployment failed")
		throw e
	},
	function() {
		console.log("Deployment completed!");
		console.log("http://"+bucketName+".s3-website-us-east-1.amazonaws.com/")
	}
)