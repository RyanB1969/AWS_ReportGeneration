const PDFGeneratorAPI = require('pdf-generator-api')
const pdf = new PDFGeneratorAPI(process.env.PDFKEY, process.env.PDFSECRET)
pdf.setBaseUrl(process.api.PDFAPIURL)
pdf.setWorkspace(process.env.PDFWORKSPACE)
const aws = require('aws-sdk')
const s3 = new aws.S3()
const sqs = new aws.SQS()

exports.lambdaHandler = async (event, context) => {
    try {
        if(validateData(event)) throw new Error('data-not-valid')
        event.Records[0].body = JSON.parse(event.Records[0].body)
        let report = await pdf.output(process.env.PDFTEMPLATEID, event)
        let params = {
            Body: Buffer.from(report.response, 'base64'), 
            Bucket: process.env.S3_BUCKET,
            Key: event.Records[0].messageAttributes.patronId.stringValue + "/" + Date.now()+report.meta.name, 
            ServerSideEncryption: "AES256",
            ACL: 'public-read',
            ContentType: report.meta['content-type']
        }
        let uploadedResponse = await putObject(params)  
        console.log(uploadedResponse)
    } catch (err) {
        var deleteParams = {
            QueueUrl: process.env.SQS_QUEUE,
            ReceiptHandle: event.Records[0].receiptHandle
        }
        await deleteMessage(deleteParams)
        let sqsParams = {
            MessageBody: JSON.stringify(event),
            MessageDeduplicationId: md5(event.Records[0].receiptHandle),
            MessageGroupId: "PlayerReportError",
            QueueUrl: process.env.SQS_ERROR_QUEUE
          };
        await sendMessage(sendParams)
        return err
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

const validateData = (data) => {
    try {
        let body = JSON.parse(data.body)
        for (let i=0; i<body.length; i++) {
            switch (true) {
                case body['Patron Name'] == '' || body['Patron Name'] == null :
                return true
                case body['Patron ID'] == '' || body['Patron ID'] == null :
                return true
                case body['Debit'] == '' || body['Debit'] == null :
                return true
                case body['Credit'] == '' || body['Credit'] == null :
                return true
                case body['Calendar Date/Time'] == '' || body['Calendar Date/Time'] == null :
                return true
                default: false
            }
        }
        let attribs = JSON.parse(body['messageAttributes'])
        for (let i=0; i<attribs.length; i++) {
            switch (true) {
                case !messageAttributes.totalCredits ||
                messageAttributes.totalCredits.stringValue == '' || 
                messageAttributes.totalCredits.stringValue == null:
                return true
                case !messageAttributes.dateRange ||
                messageAttributes.dateRange.stringValue == '' || 
                messageAttributes.dateRange.stringValue == null:
                return true
                case !messageAttributes.patronId ||
                messageAttributes.patronId.stringValue == '' || 
                messageAttributes.patronId.stringValue == null:
                return true
                case !messageAttributes.totalDue ||
                messageAttributes.totalDue.stringValue == '' || 
                messageAttributes.totalDue.stringValue == null:
                return true
                case !messageAttributes.name ||
                messageAttributes.name.stringValue == '' || 
                messageAttributes.name.stringValue == null:
                return true
                case !messageAttributes.totalDebit ||
                messageAttributes.totalDebit.stringValue == '' || 
                messageAttributes.totalDebit.stringValue == null:
                return true
                default: false
            }
        }
    } catch (e) {
        return false
    }
}

const deleteMessage = (params) => {
    return new Promise((resolve, reject) => {
        sqs.deleteMessage(params, function(err, data) {
            if (err)  reject(err)
            else resolve(data)
        });
    })
}

const sendMessage = (params) => {
    return new Promise((resolve, reject) => {
        sqs.deleteMessage(params, function(err, data) {
            if (err)  reject(err)
            else resolve(data)
        });
    })
}
