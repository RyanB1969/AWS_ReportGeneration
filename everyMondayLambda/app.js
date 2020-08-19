const axios = require('axios')
const csv = require('csvtojson')
const aws = require('aws-sdk')
const s3 = new aws.S3()
const sqs = new aws.SQS()
const md5 = require('md5');
const moment = require('moment')

exports.lambdaHandler = async (event, context) => {
    try {
        var params = {
            Bucket: "markertraxsandbox", 
            Key: "testCSV.csv"
           };
        let data = await getObject(params)
        let currentName = ''
        let lines = []
        let groupedTransactions = []
        let proccessedNames = []
        csv()
           .fromString(data.Body.toString('utf-8'))
           .subscribe((json)=>{
               if (json['Patron Name'] != '' && json['Patron Name'] != 'Total') {
                currentName = json['Patron Name']
               } else if (json['Patron Name'] == '' || json['Patron Name'] == 'Total') {
                json['Patron Name'] = currentName
               }
               lines.push(json)
           },() => {return new Error()}, () => {
            lines.pop()
            for(let i=0;i<lines.length;i++) {
                if(!proccessedNames.includes(lines[i]['Patron Name'])) {
                    proccessedNames.push(lines[i]['Patron Name'])
                    let transactions = lines.filter((line) => line['Patron Name'] == lines[i]['Patron Name'])
                    transactions.pop()
                    let userData = {}
                    let group = []
                    userData.name = lines[i]['Patron Name']
                    userData.patronId = lines[i]['Patron ID']
                    let credits = transactions.map((line) => parseFloat(line['Credit'].substring(1)))
                    let debits = transactions.map((line) => parseFloat(line['Debit'].substring(1)))
                    userData.totalCredits = credits.reduce((acc, cur) => acc + cur).toFixed(2)
                    userData.totalDebits = debits.reduce((acc, cur) => acc + cur).toFixed(2)
                    userData.totalDue = (userData.totalDebits - userData.totalCredits).toFixed(2)
                    userData.statementDate = moment().format('M/DD/YYYY')
                    console.log(userData)
                    let weekStart = moment().subtract(1, 'weeks').startOf('week').add(1, 'days').format('M/DD/YYYY')
                    let weekEnd = moment().subtract(1, 'weeks').startOf('week').add(7, 'days').format('M/DD/YYYY')
                    userData.dateRange = `${weekStart} - ${weekEnd}`
                    group.push(transactions)
                    group.push(userData)
                    groupedTransactions.push(group)
                }
            }
            let promiseArr = groupedTransactions.map((group) => {
                var sqsParams = {
                    MessageAttributes: {
                        "name": {
                          DataType: "String",
                          StringValue: group[1].name
                        },
                        "patronId": {
                          DataType: "String",
                          StringValue: group[1].patronId
                        },
                        "totalCredits": {
                          DataType: "String",
                          StringValue: '$'+ group[1].totalCredits.toString()
                        },
                        "totalDebits": {
                          DataType: "String",
                          StringValue: '$'+ group[1].totalDebits.toString()
                        },
                        "totalDue": {
                            DataType: "String",
                            StringValue: '$'+ group[1].totalDue.toString()
                          },
                        "statementDate": {
                          DataType: "String",
                          StringValue: group[1].statementDate
                        },
                        "dateRange": {
                          DataType: "String",
                          StringValue: group[1].dateRange
                        }
                      },
                    MessageBody: JSON.stringify(group[0]),
                    MessageDeduplicationId: md5(group[1].name),
                    MessageGroupId: "PlayerReport",
                    QueueUrl: process.env.SQS_QUEUE
                  };
                 return sendSQSMessage(sqsParams)
            })
            Promise.all(promiseArr).then((data) => { console.log(data) })
            return event
           })
    } catch (err) {
        console.log(err);
        return err;
    }
};

const getObject = (params) => {
    return new Promise((resolve, reject) => {
        s3.getObject(params, function(err, data) {
            if (err) reject(err)
            else resolve(data)
          });
    })
}

const sendSQSMessage = (params) => {
    return new Promise ((resolve, reject) => {
        sqs.sendMessage(params, function(err, data) {
            if (err) reject(err)
            else resolve(data)
          });
    })
}
