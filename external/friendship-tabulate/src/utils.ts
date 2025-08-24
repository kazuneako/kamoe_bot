export { del_r, toChineseNum, ChineseToNumber, shuffle }

//去除/r (QQ电脑端 消息换行是\r\n,手机端为\n)
function del_r(str:any) {
  return str.replace(/\r\n/g, "\n");
}
//阿拉伯数字转中文数字
function toChineseNum(num:number) {
  var arr1 = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九']
  var arr2 = ['', '十', '百', '千', '万', '十', '百', '千', '亿', '十', '百', '千', '万', '十', '百', '千', '亿']
  if (!num || isNaN(num)) return '零'
  var english = num.toString().split('')
  var result = ''
  for (var i = 0; i < english.length; i++) {
    var des_i = english.length - 1 - i// 倒序排列设值
    result = arr2[i] + result
    var arr1_index = english[des_i]
    result = arr1[arr1_index] + result
  }
  result = result.replace(/零(千|百|十)/g, '零').replace(/十零/g, '十') // 将【零千、零百】换成【零】 【十零】换成【十】
  result = result.replace(/零+/g, '零') // 合并中间多个零为一个零
  result = result.replace(/零亿/g, '亿').replace(/零万/g, '万') // 将【零亿】换成【亿】【零万】换成【万】
  result = result.replace(/亿万/g, '亿') // 将【亿万】换成【亿】
  result = result.replace(/零+$/, '') // 移除末尾的零
  // 将【一十】换成【十】
  result = result.replace(/^一十/g, '十')
  return result
}
//中文数字转阿拉伯数字
function ChineseToNumber(chnStr:string) {
  let rtn = 0;
  let section = 0;
  let number = 0;
  let secUnit = false;
  let str = chnStr.split('');
  let chnNameValue = {
      十: { value: 10, secUnit: false },
      百: { value: 100, secUnit: false },
      千: { value: 1000, secUnit: false },
      万: { value: 10000, secUnit: true },
      亿: { value: 100000000, secUnit: true }
  }
  //增加‘两’的对象，解决“两百零一”等数字的转换问题
  let chnNumChar = {
      零: 0,
      一: 1,
      二: 2,
      两: 2,
      三: 3,
      四: 4,
      五: 5,
      六: 6,
      七: 7,
      八: 8,
      九: 9
  };

  //因为要下载小说，所以要排除那些非正文部分章节；同时将“第十章”“第十一章”等原代码出错章节筛选出来
  if (typeof chnNumChar[str[0]] !== 'undefined' || str[0] == '十') {
      //将“第十章”“第十一章”等原代码出错章节进行单独处理
      if (str[0] == '十') {
          //因为只需要处理“十”至“十九”十个数，所以问题就很容易解决，对汉字中索引1的位置进行判断，当为空时，即为0+10=10，非空则从chnNumChar对象中取值加上10，即可得出结果。
          rtn = (chnNumChar[str[1]] || 0) + 10
      } else {
          for (let i = 0; i < str.length; i++) {
              let num = chnNumChar[str[i]];
              if (typeof num !== 'undefined') {
                  number = num;
                  if (i === str.length - 1) {
                      section += number;
                  }
              } else {
                  let unit = chnNameValue[str[i]].value;
                  secUnit = chnNameValue[str[i]].secUnit;
                  if (secUnit) {
                      section = (section + number) * unit;
                      rtn += section;
                      section = 0;
                  } else {
                      section += (number * unit);
                  }
                  number = 0;
              }
          }
      }
  //此处是将非正文章节的内容的序号设置为0，统一在爬虫下载完成的小说文件的起端放置作者的“感言、请假、设定等”文章
  } else {
      rtn = 0
      section = 0
  }

  return rtn + section;
}
//洗牌  打乱数组
function shuffle(array:any) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}