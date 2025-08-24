import { Context, Schema, h } from 'koishi'
import './DateFormat'
import { del_r, toChineseNum, ChineseToNumber, shuffle } from './utils'
export const name = 'friendship-tabulate'

export interface Config {}

export const Config: Schema<Config> = Schema.object({})

export const inject = ['database']
export const kmMessage= 'km_message';
export const functionRegistration= 'function_registration'

declare module 'koishi' {
  interface Tables {
    km_message: kmMessage
    function_registration: functionRegistration
  }
}
export interface kmMessage {
  id: number
  message_id: string
  type: string
  message_type: string
  from_user_id: string
  from_user_name: string
  from_nick_name: string
  from_group_id: string
  from_channel_id: string
  content:string
  session:string
  quote: string
  time: Date
}
export interface functionRegistration {
  id: number
  function: string
  from_user_id: string
  from_user_name: string
  from_nick_name: string
  from_group_id: string
  from_channel_id: string
  state: number
  time: Date
}
export enum FunctionEnum {
  AutomaticRecording ='AutomaticRecording'
}
// 自动记录-缓存
var cache_ar={};
// 帮助-缓存
var helpInfo='';

export function apply(ctx: Context) {
  ctx.model.extend(kmMessage, {
    // 各字段类型
    id: 'unsigned',
    message_id: 'string',
    type: 'string',
    message_type: 'string',
    from_user_id: 'string',
    from_user_name: 'string',
    from_nick_name: 'string',
    from_group_id: 'string',
    from_channel_id: 'string',
    content:'text',
    session:'text',
    quote: 'text',
    time: 'timestamp',
  }, {
    // 使用自增的主键值
    autoInc: true,
  })
  ctx.model.extend(functionRegistration, {
    // 各字段类型
    id: 'unsigned',
    function: 'string',
    from_user_id: 'string',
    from_user_name: 'string',
    from_nick_name: 'string',
    from_group_id: 'string',
    from_channel_id: 'string',
    state:'integer',
    time: 'timestamp',
  }, {
    // 使用自增的主键值
    autoInc: true,
  })
  ctx.on('ready', () => {
    let commands=['淘汰赛排表','排表','记录','第n轮','set','更多帮助'];
    let helpStart='------帮助------\n';
    let helpEnd='---------------\n所有命令都以%开头';
    commands.forEach((obj)=>{
      helpStart+=obj+'\n';
    })
    helpInfo=helpStart+helpEnd;
    async function dodatabase() {
      const rows = await ctx.database.get(functionRegistration, { function:{ $eq:FunctionEnum.AutomaticRecording } })
      // console.info(rows)
      rows.forEach((obj)=>{
        cache_ar[obj['from_channel_id']]=obj['state']==1;
      })
      ctx.database.remove(kmMessage, { time: { $lt: new Date(new Date().getTime()-86400*30) } })
      // console.info('自动记录已加载群聊：',cache_ar)
      // ctx.database.remove(memberEvents, { time: { $lt: new Date(new Date().getTime()-86400*3) } })
    }
    //设置休眠时间否则database的get方法不会加载
    setTimeout(()=>{
      dodatabase();
    }, 2000);
  })
  ctx.on('message', (session) => {
    // console.info('----------')
    // console.info(session)
    // console.info('----------')
    // console.info(JSON.stringify(session.elements))
    // console.info('----------')
    if(session.selfId==='koishi')return;
    if(session.elements.length==0)return;
    let content=session.elements[session.elements.length-1].attrs.content
    let message={
      message_id: session.messageId,
      type: session.type,
      message_type: session.subtype,
      from_user_id: session.userId,
      from_user_name: session.author.username,
      from_nick_name: session.author.nick,
      from_group_id: session.guildId,
      from_channel_id: session.channelId,
      content:content,
      session:JSON.stringify(session),
      quote: JSON.stringify(session.quote),
      time: new Date(session.timestamp)
    }
    ctx.database.create(kmMessage,message)
  })
  ctx.on('before-send', (session) => {
    // console.info(session)
    // console.info(JSON.stringify(session.event.message.elements))
    if(session.event.message.elements.length==0)return;
    let content=session.elements[session.event.message.elements.length-1].attrs.content
    let message={
      message_id: session.messageId,
      type: session.type,
      message_type: session.subtype,
      from_user_id: session.event.selfId,
      from_user_name: session.author.username,
      from_nick_name: session.author.nickname,
      from_group_id: session.guildId,
      from_channel_id: session.channelId,
      content:content,
      session:JSON.stringify(session),
      quote: JSON.stringify(session.quote),
      time: new Date()
    }
    ctx.database.create(kmMessage,message)
  })
  //获取最后一张表
  async function getEndTable(groupNumber:any) {
    // let maxid=await ctx.database.eval(kmMessage,{$max:'id'}, { from_channel_id:{ $eq:groupNumber }, content:{ $regex:'---第一轮---' }  })
    // let msg=await ctx.database.get(kmMessage,{ id:{ $eq:maxid } })
    let msg=await ctx.database.get(kmMessage,{ from_channel_id:{ $eq:groupNumber }, content:{ $regex:'---第一轮---' }  },{ limit:1, sort:{ time:'desc' } })
    if(msg.length>0)
      return msg[0]['content'];
    return undefined;
  }
  // 帮助
  ctx.command('help').alias('帮助').action(({session})=>{
    session.send(helpInfo);
  })
  // 更多帮助
  ctx.command('更多帮助').action(({session})=>{
    //\n帮助说明：\nkazuneako.haruyu.me/bot/koishi/ygo/ygo-tabulate-use-help
    session.send('加群关注排表姬（699930475）');
  })
  // 自动记录
  ctx.middleware((session, next) => {
    if(session["subtype"]=="group" && session.content.search('[0-2]{2}')==0 && session.author.nick.indexOf(' ')>0 && cache_ar[session.channelId]!= false){
      async function takeNotes(){
        let table=await getEndTable(session.channelId);
        if(cache_ar[session.channelId]==undefined && table!=undefined){
          let ardata={
            function: FunctionEnum.AutomaticRecording,
            from_user_id: session.bot.userId,
            from_user_name: session.bot.username,
            from_nick_name: session.bot.nickname,
            from_group_id: session.guildId,
            from_channel_id: session.channelId,
            state: 1,
            time: new Date(),
          }
          await ctx.database.set(functionRegistration, { function:{ $eq:ardata.function },from_channel_id:{ $eq:session.channelId } }, ardata);
          cache_ar[ardata.from_channel_id]=true;
        }
        let score=session.content.substring(0,2);
        let scoreArr=score.split("");
        let team=session.author.nick.substring(0,session.author.nick.indexOf(' ')).toUpperCase();
        let player=session.author.nick.substring(session.author.nick.indexOf(' ')+1);
        let leftReg=new RegExp(player+"\\s+0:0\\s+",'i');
        let rightReg=new RegExp("\\s+0:0\\s+"+player,'i');
        let teamInfo=table.substring(0,table.indexOf('\n')).toUpperCase();
        if(teamInfo.search(team+'\\s+VS\\s+')>0){
          table=table.replace(leftReg,player+"  "+scoreArr[0]+":"+scoreArr[1]+"  ");
        }else if(teamInfo.search('\\s+VS\\s+'+team)>0){
          table=table.replace(rightReg,"  "+scoreArr[1]+":"+scoreArr[0]+"  "+player);
        }else return;
        session.send(table);
      }
      takeNotes();
    }
    return next();
  })
  // 功能设置
  ctx.command('set')
  .option('automaticRecording','-a <type>')
  .action(({session,options})=>{
    if(session["subtype"]!="group")return;
    if(session.content==='%set'){
      session.send('若要开启或关闭功能\n0代表关闭，1为开启。格式如下：\n%set -选项 值（如：%set -a 0）\n选项如下：\na.自动记录');
      return;
    }
    console.info(session,options,options.automaticRecording)
    if(options.automaticRecording!=undefined){
      async function setar(type:number) {
        let ardata={
          function: FunctionEnum.AutomaticRecording,
          from_user_id: session.userId,
          from_user_name: session.author.username,
          from_nick_name: session.author.nick,
          from_group_id: session.guildId,
          from_channel_id: session.channelId,
          state: type,
          time: new Date(),
        }
        if(type==0){
          if(cache_ar[ardata.from_channel_id]===undefined){
            await ctx.database.create(functionRegistration,ardata);
            cache_ar[ardata.from_channel_id]=false;
          }else if(cache_ar[ardata.from_channel_id]==false){
            session.send('自动记录已关闭,请勿重复关闭！');
            return;
          }else{
            await ctx.database.set(functionRegistration, { function:{ $eq:ardata.function },from_channel_id:{ $eq:session.channelId } }, ardata);
            cache_ar[ardata.from_channel_id]=false;
          }
          session.send('自动记录已关闭！');
        }else if(type==1){
          if(cache_ar[ardata.from_channel_id]===undefined){
            await ctx.database.create(functionRegistration,ardata);
            cache_ar[ardata.from_channel_id]=true;
          }else if(cache_ar[ardata.from_channel_id]){
            session.send('自动记录已开启,请勿重复开启！');
            return;
          }else{
            await ctx.database.set(functionRegistration, { function:{ $eq:ardata.function },from_channel_id:{ $eq:session.channelId } }, ardata);
            cache_ar[ardata.from_channel_id]=true;
          }
          session.send('自动记录已开启！');
        }else{
          session.send(h('quote',{ id:session.messageId })+'参数类型不正确！')
        }
      }
      setar(options.automaticRecording)
    }
    // session.send();
  })
  // 下一轮
  ctx.command('下一轮').action(({session},num)=>{
    if(session["subtype"]!="group")return;
    session.content=del_r(session.content);
    if(session.content==='%下一轮'){
      session.send("结算单条：\n%下一轮\n萌新 鸽子\n结算多条：\n%下一轮\n萌新 大佬\n鸽子 02 遗老\n结算不仅可以多条结算还可以带分数");
    }else{
      let infotext=session.content.substring(session.content.indexOf("\n")); 
      let infoArr:Array<string>=infotext.split('\n');
      infoArr.shift();

      async function takeNotes(){
        let table=await getEndTable(session.channelId);
        // 记录轮次
        let recordRound:any=table.substring(table.lastIndexOf('---第')+4,table.lastIndexOf('轮---'))
        if(recordRound instanceof Number)
          recordRound=toChineseNum(Number(recordRound));
        recordRound=toChineseNum(ChineseToNumber(recordRound)+1);
        table+='\n------第'+recordRound+'轮------';

        infoArr.forEach((obj:string)=>{
          let textarr:Array<string>=obj.split(' ');
          if(textarr.length===3)
            table=addScoring(table,recordRound,textarr[0],textarr[1],textarr[2]);
          else if(textarr.length===2)
            table=addScoring(table,recordRound,textarr[0],'00',textarr[1]);
        })
        session.send(table.replaceAll('\n\n','\n'));
      }
      takeNotes();
    }
  })

  // 第n轮 middleware 写法
  ctx.middleware((session, next) => {
    if(session["subtype"]=="group" && session.content.search('%第.+轮')==0){
      if(session.content==='%第n轮'){
        session.send("结算单条：\n%第几轮\n萌新 鸽子\n结算多条：\n%第几轮\n萌新 大佬\n鸽子 02 遗老\n结算不仅可以多条结算还可以带分数");
      }else{
        session.content=del_r(session.content);
        // let infotext=session.content.substring(session.content.indexOf("\n")); 
        let infotext=session.content;
        let infoArr:Array<string>=infotext.split('\n');
        // 记录轮次
        let recordRound:any;

        async function takeNotes(){
          let table=await getEndTable(session.channelId);
          infoArr.forEach((obj:string)=>{
            if(obj.match("%第.+轮")){
              if(obj.match("%第\\d+轮"))
                recordRound=toChineseNum(Number(obj.substring(obj.indexOf('%第')+2,obj.lastIndexOf('轮'))));
              else recordRound=obj.substring(obj.indexOf('%第')+2,obj.lastIndexOf('轮'));
              let roundReg=new RegExp('-+第'+recordRound+'轮-+');
              if(!roundReg.test(table)) table+='\n------第'+recordRound+'轮------';
              return;
            }
            let textarr:Array<string>=obj.split(' ');
            if(textarr.length===3)
              table=addScoring(table,recordRound,textarr[0],textarr[1],textarr[2]);
            else if(textarr.length===2)
              table=addScoring(table,recordRound,textarr[0],'00',textarr[1]);
          })
          session.send(table.replaceAll('\n\n','\n'));
        }
        takeNotes();
      }
    }
    return next();
  })
  // // 指令未响应先注释掉 2023-03-08
  // ctx.command('第<num>轮').action(({session},num)=>{
  //   console.info(session,num)
  //   if(session["subtype"]!="group")return;
  //   if(session.content==='%第n轮'){
  //     session.send("结算单条：\n%第几轮\n萌新 鸽子\n结算多条：\n%第几轮\n萌新 大佬\n鸽子 02 遗老\n结算不仅可以多条结算还可以带分数");
  //   }else{
  //       session.content=del_r(session.content);
  //       // let infotext=session.content.substring(session.content.indexOf("\n")); 
  //       let infotext=session.content;
  //       let infoArr:Array<string>=infotext.split('\n');
  //       // 记录轮次
  //       let recordRound:any;

  //       async function takeNotes(){
  //         let table=await getEndTable(session.channelId);
  //         infoArr.forEach((obj:string)=>{
  //           if(obj.match("%第.+轮")){
  //             if(obj.match("%第\\d+轮"))
  //               recordRound=toChineseNum(Number(obj.substring(obj.indexOf('%第')+2,obj.lastIndexOf('轮'))));
  //             else recordRound=obj.substring(obj.indexOf('%第')+2,obj.lastIndexOf('轮'));
  //             let roundReg=new RegExp('-+第'+recordRound+'轮-+');
  //             if(!roundReg.test(table)) table+='\n------第'+recordRound+'轮------';
  //             return;
  //           }
  //           let textarr:Array<string>=obj.split(' ');
  //           if(textarr.length===3)
  //             table=addScoring(table,recordRound,textarr[0],textarr[1],textarr[2]);
  //           else if(textarr.length===2)
  //             table=addScoring(table,recordRound,textarr[0],'00',textarr[1]);
  //         })
  //         session.send(table.replaceAll('\n\n','\n'));
  //       }
  //       takeNotes();
  //   }
  // })
  ctx.command('记录').action(({session})=>{
    if(session["subtype"]!="group")return;
    session.content=del_r(session.content);
    if(session.content==='%记录'){
      session.send("记录单条：\n%记录\n萌新 20\n记录多条：\n%记录\n萌新 20\n鸽子 02");
    }else{
      // 第n轮记录模式
      let recordMode:boolean=false;
      let recordRound:any;

      let infotext=session.content.substring(session.content.indexOf("\n")); 
      let infoArr:Array<string>=infotext.split('\n');
      infoArr.shift();
      async function takeNotes(){
        let table=await getEndTable(session.channelId);
        infoArr.forEach((obj:string)=>{
          if(obj.match("%第.+轮")){
            if(obj.match("%第\\d+轮"))
              recordRound=toChineseNum(Number(obj.substring(obj.indexOf('%第')+2,obj.lastIndexOf('轮'))));
            else recordRound=obj.substring(obj.indexOf('%第')+2,obj.lastIndexOf('轮'));
            let roundReg=new RegExp('-+第'+recordRound+'轮-+');
            if(!roundReg.test(table)) table+='\n------第'+recordRound+'轮------';
            recordMode=true;
            return;
          }
          if(recordMode){
            let textarr:Array<string>=obj.split(' ');
            if(textarr.length===3)
              table=addScoring(table,recordRound,textarr[0],textarr[1],textarr[2]);
            else if(textarr.length===2)
              table=addScoring(table,recordRound,textarr[0],'00',textarr[1]);
          }else{
            let player=obj.substring(0,obj.lastIndexOf(' '));
            let score=obj.substring(obj.lastIndexOf(' ')+1);
            table=scoring(table,player,score);
          }
        })
        session.send(table.replaceAll('\n\n','\n'));
      }
      takeNotes();
    }
  })
  ctx.command('排表').action(({session})=>{
    // console.info(session)
    // if(session["subtype"]!="group")return;
    session.content=del_r(session.content);
    if(session.content==='%排表'){
      async function sendmsg() {
        await session.send("欢迎使用YGO排表插件\n人头赛第一行：(%排表+空格+人头)\n更多功能请发送：%帮助\n排表格式：");
        session.send("%排表\na队:云玩家 萌新 遗老\nb队:复读机 鸽子 柠檬");
      }
      sendmsg()
    }else{
      let commandLine=session.content.substring(0,session.content.indexOf("\n")) 
      //判断并获取分隔符
      // let separate=commandLine.lastIndexOf(" ")+2===commandLine.length?',':' '
      let separate=' ';
      //判断并获取规则
      let rule=commandLine.indexOf(" 人头")>0?'人头赛':'2/3【KOF】'
      let msg=session.content.substring(commandLine.length+1)
      session.send(friendshipTabulate(msg,rule,separate,session["channelId"]));
    }
  })
  ctx.command('淘汰赛排表')
  .option('name','赛事名称')
  .action(({session},name)=>{
    if(session["subtype"]!="group")return;
    if(session.content==='%淘汰赛排表'){
      async function sendmsg() {
        await session.send("默认参赛人数为单数将有一位玩家轮空。\n淘汰赛排表格式如下：");
        session.send("%淘汰赛排表\n赛事名称:比武招亲\n参赛选手:鸽子 萌新 咕咕子 大佬");
      }
      sendmsg()
    }else{
      session.content=del_r(session.content);
      let commandLine=session.content.substring(0,session.content.indexOf("\n")) 
      
      let msg=session.content.substring(commandLine.length+1);
      let matchName=name;
      let memberList=[];
      function getMemberList(str:string){
        if(str.startsWith('参赛选手:')) return memberList=str.substring(5).split(/\s/);
        else return memberList=str.split(/\s/);
      }
      if(msg.indexOf('\n')>0) msg.split('\n').forEach(obj=>{
        if(obj.startsWith('赛事名称:')) matchName=obj.substring(5);
        else memberList=getMemberList(obj);
      });
      else memberList=getMemberList(msg);
      if(memberList.length>0)
        session.send(outMatchTabulate(matchName,memberList,'淘汰赛',session["channelId"]));
    }
  })
}

function outMatchTabulate(matchName:string,memberList:Array<string>,rule:string,groupNumber:any){
  memberList=shuffle(memberList);
  if(memberList.length%2!=0) memberList.push('轮空');
  let memberList1=memberList.slice(0, memberList.length/2);
  let memberList2=memberList.slice(memberList.length/2);
  
  let match="";
  for (let i=0;i<memberList1.length;i++) {
    match+="\n[第"+(i+1)+"组]\n"+memberList1[i]+"  0:0  "+memberList2[i]
  }
  let table="名称: "+matchName+"\n"+
    				"时间: "+new Date().format('yyyy.MM.dd')+"\n"+
    				"规则: "+rule+"\n"+
    				"地点: "+groupNumber+"\n"+
    				"------第一轮------"+
            match;
  table+="\n------第二轮------";
  return table
}

//友谊排表  ( msg:消息本体, rule:规则(人头或KOF), separate:分隔符 )
function friendshipTabulate(msg:string,rule:string,separate:string,groupNumber:any){
  let lines=msg.split("\n");
  if(lines.length<2) return "排表不满足两支队伍，或排表格式错误！";
  let teamName1=lines[0].substring(0, lines[0].indexOf(":"));
  let teamName2=lines[1].substring(0, lines[1].indexOf(":"));
  let team1=lines[0].substring(lines[0].indexOf(":")+1).split(separate);
  let team2=lines[1].substring(lines[1].indexOf(":")+1).split(separate);
  if(team1.length!=team2.length) return "队伍成员数量不一致！";
  team1=shuffle(team1)
  team2=shuffle(team2)
  let match="";
  for (let i=0;i<team1.length;i++) {
    match+="\n"+team1[i]+"  0:0  "+team2[i]
  }
  let table="战队: "+teamName1.toUpperCase()+" VS "+teamName2.toUpperCase()+"\n"+
    				"时间: "+new Date().toISOString().slice(0, 10).replaceAll('-','.')+"\n"+
    				"规则: "+rule+"\n"+
    				"地点: "+groupNumber+"\n"+
    				"------第一轮------"+
            match;
  if(rule!='人头赛')table+="\n------第二轮------";
  return table
}
//计分
function scoring(table:string,player:string,score:string) {
  let scoreArr=score.split("");
  let leftReg=new RegExp(player+"\\s+0:0\\s+",'i');
  let rightReg=new RegExp("\\s+0:0\\s+"+player,'i');
  if(leftReg.test(table))
    table=table.replace(leftReg,player+"  "+scoreArr[0]+":"+scoreArr[1]+"  ");
  else if(rightReg.test(table))
    table=table.replace(rightReg,"  "+scoreArr[1]+":"+scoreArr[0]+"  "+player);
  else return null;
  return table;
}
//追加计分
function addScoring(table:string,recordRound:any,player:string,score:string,opponent?:string) {
  if(opponent===undefined)opponent="";
  let roundReg=new RegExp('-+第'+recordRound+'轮-+');
  let scoreArr=score.split("");

  let headtable=table.substring(0,table.search(roundReg));
  let bodytable=table.substring(table.search(roundReg));
  let roundRow='';
  let roundBody='';
  if(bodytable.indexOf('\n')>0)
    roundRow=bodytable.substring(0,bodytable.indexOf('\n')+1),
    roundBody=bodytable.substring(bodytable.indexOf('\n')+1);
  else 
    roundRow=bodytable.substring(0,bodytable.lastIndexOf('-')+1),
    roundBody=bodytable.substring(bodytable.lastIndexOf('-')+1);
  
  let leftReg=new RegExp(player+"\\s+0:0\\s+"+opponent,'i');
  let rightReg=new RegExp(opponent+"\\s+0:0\\s+"+player,'i');
  if(leftReg.test(roundBody))
    roundBody=roundBody.replace(leftReg,player+"  "+scoreArr[0]+":"+scoreArr[1]+"  "+opponent);
  else if(rightReg.test(roundBody))
    roundBody=roundBody.replace(rightReg,opponent+"  "+scoreArr[1]+":"+scoreArr[0]+"  "+player);
  else roundBody='\n'+player+'  '+scoreArr[0]+":"+scoreArr[1]+'  '+opponent+'\n'+roundBody;
  return (headtable+roundRow+roundBody);
}
