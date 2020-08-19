const aws = require('aws-sdk')
const moment = require('moment')
const s3 = new aws.S3()

exports.lambdaHandler = async (event, context) => {
    try {
        let params = {
            Body: event, 
            Bucket: process.env.S3_ERROR_BUCKET,
            Key: `${moment().format('MM-DD-YYYY')}/${event.Records[0].messageId}`,
            ACL: 'public-read',
            ContentType: 'application/json'
        }
        let uploadedError = await putObject(params)  
        console.log(uploadedError)
    } catch (err) {
        console.log(err)
    }
}

const putObject = (params) => {
    return new Promise((resolve, reject) => {
        s3.putObject(params, function(err, data) {
            if (err) reject(err)
            else resolve(data)
          })
    })
}