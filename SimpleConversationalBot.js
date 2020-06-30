var config = require("./config");
var botId = Object.keys(config.credentials)
var botName = config.botName;
var sdk = require("./lib/sdk");
// var extendRequestId=require("./lib/sdk/index.js")
var loadash = require('lodash');
var schedular = require('node-schedule');
var schedule,emailId;
var channels=[]
var flag=0,reqId,previousChannel={},previousKey={},previousData={};
// schedule = schedular.scheduleJob('* 10 * * * *', schedularCallBack);

function schedularCallBack(requestId,data,callback) {
    console.log("Invoking the scheduler");
    sdk.extendRequestId(data,callback)
    console.log("Schedular Running")
            //getPendingMessages("ujwal.tadur@kore.com").then(function () {
    // getPendingMessages(emailId).then(function(){
    //     console.log("came after checking in redis")
    // })
    // .catch(function (e) {
    //     console.log('error in schedular', e.message);
    // });
}
function getPendingMessages(uuid) {
    var entities,intent;
    try {
        return sdk.getSavedData(uuid).then(function (_data) {
            entities = _data.context.entities;
            intent=_data.context.intent
            console.log("RTM entities : ", entities);
            sdk.getSavedData("msteams_" +"data").then(function (__data) {
                __data.context.session.BotUserSession['PreEntities']=entities;
                __data.message = intent//"Reset Password "//+Object.values(entities).join(" ").trim();
                console.log("1 : ", __data.message);
                return sdk.sendBotMessage(__data)//,()=>{
                    // var clone_obj=loadash.clone(__data)
                    // clone_obj.message="Hello Test"
                    // return sdk.sendUserMessage(clone_obj)})
                //     .then(function () {
                //     if (schedule) {
                //         // console.log("scheduler has been cancelled ")
                //         // schedule.cancel();
                //     }
                // });
            });
        });
    } catch (ex) {
        console.log("Error in retriving data")
    }
}

module.exports = {
    botId: botId,
    botName: botName,

    on_user_message: function (requestId, data, callback) {
        console.log("In on_user_message")
        var channelType = loadash.get(data, 'channel.type');
        if(channelType=="rtm")
        {
            emailId=data.context.session.UserContext.emailId||data.context.session.UserContext.identities[0].val
            console.log("In rtm: ",emailId)
            if (channelType ==="rtm"){ //"msteams") {
            //if (data.message === "save") {
            if(data.channel.handle.type=="welcome"){
               return sdk.saveChannelData(channelType + "_"+emailId, data).then(function () {
                    console.log("Saved the data");
                    data.message = "Saved the data to redis...";
                    schedule = schedular.scheduleJob('* * * * * *', ()=>{schedularCallBack(requestId,data,callback)});
                    // return sdk.sendUserMessage(data)
                    return sdk.sendBotMessage(data,callback)
                })
            } else {
                return sdk.sendBotMessage(data, callback);
            }
        }
        }
        if(channelType=="email")
        {
            var s=data.context.session.UserContext.identities[0].val.split("/")[1]
            var w=data.channel.from.split("/")[1]
            emailId=data.context.session.UserContext.identities[0].val.split("/")[1]||data.channel.from.split("/")[1]
            console.log("In email: ", emailId)
        }
        if((emailId in previousData)==false)
        {
                previousData[emailId]={"previousChannel":"",previousKey:""}
        }
        if(channelType.indexOf(channels)===-1||channels.length==0)
        {
            channels.push(channelType)
            reqId=requestId;
            flag=1;
            data.message="Hey"
            sdk.sendUserMessage(data,callback)
        }
        console.log("OnUserMsg : ", channelType, data.message);
        console.log(JSON.stringify(data))
        if (data.message) {
            return sdk.sendBotMessage(data, callback);
        }
        else{
            return sdk.sendBotMessage(data, callback);
        }
    },
    on_bot_message: function (requestId, data, callback) {
        var channelType = loadash.get(data, 'channel.type');
        console.log("OnBotMsg : ", channelType, data.message);
        if (channelType === "rtm" || channelType === "email") {
                var key=channelType+"_"+emailId
                sdk.saveChannelData(key,data)
            //sdk.saveChannelData("ujwal.tadur@kore.com", data);
            console.log(data.context.entities);
            // if (data.message.indexOf("message") > -1) {
                if(previousData[emailId]["previousChannel"]!=channelType&&previousData[emailId]["previousChannel"]!=""){
                // sdk.extendRequestId(requestId)
                // console.log("Triggering the schedular")
                // schedule = schedular.scheduleJob('10 * * * * *', ()=>{schedularCallBack(requestId,data,callback)});
                getPendingMessages(previousData[emailId]["previousKey"])
                //return sdk.skipBotMessage(data,callback);
            }
            
        }
        previousData[emailId]={"previousChannel":channelType,"previousKey":key}
        // console.log(data.channel.handle.type)
        previousChannel[emailId]=channelType
        previousKey=key
        return sdk.sendUserMessage(data, callback);
    },
    on_agent_transfer: function (requestId, data, callback) {
        return callback(null, data);
    },
    on_event: function (requestId, data, callback) {
        console.log("on_event -->  Event : ", data.event);
        return sdk.sendAlertMessage(data,callback)//callback(null, data);
    },
    on_alert: function (requestId, data, callback) {
        console.log("on_alert -->  : ", data, data.message);
        return sdk.sendAlertMessage(data, callback);
    }
};


