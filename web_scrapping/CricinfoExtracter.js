//purpose:: Extract information of worldcup 2019 from cricinfo and present that in the form of excel and pdf scorecard
//the real purpose is to learn how to extract information and get experience with js
//good reason to make a project::--to have good fun

//node CricinfoExtracter.js --source=https://www.espncricinfo.com/series/icc-cricket-world-cup-2019-1144415/match-results --dest=Worldcup.xls --dataFolder=data

let minimist = require('minimist');
let fs= require("fs");
let axios = require("axios");
let jsdom = require("jsdom");
let excel = require("excel4node");
let path = require("path");
let pdf = require("pdf-lib");


let args=minimist(process.argv);

let responseKaPromise = axios.get(args.source);
responseKaPromise.then(function(response){
  let html = response.data;
  
  let dom=new jsdom.JSDOM(html);
  let document = dom.window.document;

  let matches=[];

  let matchScoreDivs=document.querySelectorAll("div.match-score-block");

  for(let i=0;i<matchScoreDivs.length;i++){
    let match ={
      team1:"",
      team2:"",
      team1Score:"",
      team2Score:"",
      result:""
    };

    let teamPara=matchScoreDivs[i].querySelectorAll("div.name-detail > p.name");
    match.team1=teamPara[0].textContent;
    match.team2=teamPara[1].textContent;

    let scoreSpans=matchScoreDivs[i].querySelectorAll("div.score-detail > span.score");
    if(scoreSpans.length==2){
      match.team1Score=scoreSpans[0].textContent;
      match.team2Score=scoreSpans[1].textContent;
    }else if(scoreSpans.length==1){
      match.team1Score=scoreSpans[0].textContent;
      match.team2Score="";
    }else{
      match.team1Score="";
      match.team2Score="";
    }

    let resultSpan=matchScoreDivs[i].querySelector("div.status-text > span");
    match.result=resultSpan.textContent;
    matches.push(match);
  }

  let matchesKaJSON=JSON.stringify(matches);
  fs.writeFileSync("matches.json",matchesKaJSON,"utf-8");

  let teams=[];
  for(let i=0;i<matches.length;i++){
    putTeamInArray(teams,matches[i].team1);
    putTeamInArray(teams,matches[i].team2);
  }

  for(let i=0;i<matches.length;i++){
    putMatchInTeams(teams,matches[i].team1,matches[i].team2,matches[i].team1Score,matches[i].team2Score,matches[i].result);
    putMatchInTeams(teams,matches[i].team2,matches[i].team1,matches[i].team2Score,matches[i].team1Score,matches[i].result);
  }

  let teamsKaJson=JSON.stringify(teams);
  fs.writeFileSync("teams.json",teamsKaJson,"utf-8");

  createExcelFiles(teams,args.dest);

  createFoldersAndPdfs(teams,args.dataFolder);
}).catch(function(err){
  console.log(err);
})

function putTeamInArray(teams,teamName){
  let tidx=-1;

  for(let i=0;i<teams.length;i++){
    if(teams[i].name == teamName){
      tidx=i;
      break;
    }
  }

    if(tidx==-1){
      let team = {
        name: teamName,
        matches: []
      }
      teams.push(team);
    }
}

function putMatchInTeams(teams,selfTeam,oppTeam,teamSScore,teamOScore,teamResult){
  let tidx=-1;

  for(let i=0;i<teams.length;i++){
    if(teams[i].name==selfTeam){
      tidx=i;
      break;
    }
  }

  teams[tidx].matches.push({
    vs: oppTeam,
    selfScore: teamSScore,
    oppScore: teamOScore,
    result: teamResult
  });
}

function createExcelFiles(teams,excelFile){
  let wb=new excel.Workbook();

  for(let i=0;i<teams.length;i++){
    let sheet=wb.addWorksheet(teams[i].name);
    sheet.cell(1,1).string("Vs");
    sheet.cell(1,2).string("SelfScore");
    sheet.cell(1,3).string("OppScore");
    sheet.cell(1,4).string("Result");

    for(let j=0;j<teams[i].matches.length;j++){
      sheet.cell(2+j,1).string(teams[i].matches[j].vs);
      sheet.cell(2+j,2).string(teams[i].matches[j].selfScore);
      sheet.cell(2+j,3).string(teams[i].matches[j].oppScore);
      sheet.cell(2+j,4).string(teams[i].matches[j].result);
    }
  }
  wb.write(excelFile);
}

function createFoldersAndPdfs(teams,dataDir){
  if(fs.existsSync(dataDir)==true){
    fs.rmdirSync(dataDir,{ recursive : true});
  }

  fs.mkdirSync(dataDir);

  for(let i=0;i<teams.length;i++){
    let teamFN = path.join(dataDir,teams[i].name);
    if(fs.existsSync(teamFN) == false){
      fs.mkdirSync(teamFN);
    }

    for(let j=0;j<teams[i].matches.length;j++){
      let match = teams[i].matches[j];
      createScoreCard(teamFN,match,teams[i].name);
    }
  }
}

function createScoreCard(teamFN,match,teamName){

  let t1 = teamName;
  let t2 = match.vs;
  let t1s = match.selfScore;
  let t2s = match.oppScore;
  let res = match.result;

  let matchFileName = path.join(teamFN,match.vs);

  let bytesOfTemplate = fs.readFileSync("template.pdf");
  let pdfKaPromise = pdf.PDFDocument.load(bytesOfTemplate);

  pdfKaPromise.then(function(pdfdoc){
    let page = pdfdoc.getPage(0);

    page.drawText(t1, {
      x: 500,
      y: 355,
      size: 14
    });

    page.drawText(t2,{
      x: 500,
      y: 323,
      size: 14
    });

    page.drawText(t1s,{
      x: 500,
      y: 295,
      size: 14
    });

    page.drawText(t2s,{
      x: 500,
      y: 268,
      size: 14
    });

    page.drawText(res,{
      x: 500,
      y: 240,
      size: 14
    });

    let finalPdfBytesKaPromise = pdfdoc.save();

    finalPdfBytesKaPromise.then(function(finalBytes){
      if(fs.existsSync(matchFileName+".pdf") == true){
        fs.writeFileSync(matchFileName + "1.pdf",finalBytes);
      }else{
        fs.writeFileSync(matchFileName + ".pdf",finalBytes);
      }
    });
  });
}