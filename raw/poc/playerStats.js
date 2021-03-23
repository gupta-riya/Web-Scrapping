let request = require('request');
let cheerio = require('cheerio');
let path = require('path');
let fs = require('fs');


let url = "https://www.espncricinfo.com/series/ipl-2020-21-1210595";

request(url,cb);                                    //request to main page

function cb(err,resp,html)
{
    if(err)
    {
        console.log(err);
    }
    else
    {
        getTeamAndResult(html);                        
        
    }
}

function getTeamAndResult(html)                         //extract team and results url
{
    let selTool = cheerio.load(html);
    let allLinks = [];
    let teamUrl = selTool("a[data-hover='Table']").attr('href');
    allLinks[0] = "https://www.espncricinfo.com" + teamUrl;                //get full link for table navlink
    let resultUrl = selTool("a[data-hover='Fixtures and Results']").attr('href');
    allLinks[1] = "https://www.espncricinfo.com" + resultUrl;                //get full link for result navlink

    callExtraction(allLinks,0);
}


function callExtraction(allLinks,n)                     //sync recursive function to first create team folders and then call result extraction
{
    if(n==allLinks.length)
    return;

    request(allLinks[n],cb);
    function cb(err,resp,html)
    {
        if(err)
        {
            console.log(err);
        }
        else
        {
            if(n==0)
            extractTeams(html);
            else
            {
                extractResults(html);
                
            }
            callExtraction(allLinks,n+1);
        }
    }

    

    
}

//extract team names and call for create Directory function

function extractTeams(html)
{
    let selTool = cheerio.load(html);
    let teamNames = selTool(".header-title");

    
    for(let i = 1 ; i < teamNames.length ; i++)
    {
        let teamName = selTool(teamNames[i]).text();
        createDirectory(teamName);
    }
   
}

//create directory if its not already there with team name
function createDirectory(teamName)
{
    let dirPath = path.join(__dirname,teamName);
    if(fs.existsSync(dirPath)==false)
    {
        fs.mkdirSync(dirPath);
        console.log(teamName);
    }
}

//visit to score card of each match and call getDetails function 
function extractResults(html)
{
    let selTool = cheerio.load(html);
    let scoreUrl = selTool("a[data-hover='Scorecard']");

    let scoreLinks = [];
    for(let i = 0 ; i < scoreUrl.length ; i++)
    {
        let  halfUrl = selTool(scoreUrl[i]).attr("href");
        scoreLinks[i] = "https://www.espncricinfo.com" + halfUrl;
    }

    getDetails(scoreLinks,0);

    
}

//recursive call to get detail function
function getDetails(scoreLinks,n)
{
    if(n==scoreLinks.length)
    {
        return;
    }

    request(scoreLinks[n],cb);
    function cb(err,resp,html)
    {
        if(err)
        {
            console.log(err);
        }
        else
        {
            extractDetails(html);
            getDetails(scoreLinks,n+1);
        }
    }

   

}

//extract details of each player in the match corresponding to team
function extractDetails(html)
{
    let selTool = cheerio.load(html);
      
    let teams = selTool(".Collapsible h5.header-title.label");
    let teamName = [];
    teamName[0] = selTool(teams[0]).text().split('INNINGS')[0].trim();
    teamName[1] = selTool(teams[1]).text().split('INNINGS')[0].trim();

    let tablesBatsman = selTool(".table.batsman");
    let regex = /^[A-Za-z]+$/;
    
    for(let i = 0 ; i < tablesBatsman.length ; i++)
    {
        let tableRowDetail = selTool(tablesBatsman[i]).find("tbody tr");
        for(let j = 0 ; j < tableRowDetail.length-1 ; j++)
        {
            let tableColumn = selTool(tableRowDetail[j]).find("td");
            let name = selTool(tableColumn[0]).find("a").text().trim();
            //console.log("name - " + name);
            let extraChar = selTool(tableColumn[0]).find("a span").text().trim();
           // console.log("extras - " + extraChar);
            let batsmanName = "";
            if(extraChar.length>0)
            {               
                batsmanName = name.replace(extraChar,"").trim();                
            }
            else
            {
                batsmanName = name.trim();
            }
           
          
            if(batsmanName!="")
            {

                let opponent = i==0?teamName[1]:teamName[0];
                let description = selTool(".event .description").text();
                let matchDesc = description.split(",");
                matchObj = {

                    "runs" : selTool(tableColumn[2]).text().trim(),
                    "balls": selTool(tableColumn[3]).text().trim(),
                    "fours": selTool(tableColumn[5]).text().trim(),
                    "sixes": selTool(tableColumn[6]).text().trim(),
                    "sr" : selTool(tableColumn[7]).text().trim(),
                    "date": matchDesc[2].trim(),
                    "venue":matchDesc[1].trim(), 
                    "result": selTool(".event .status-text").text().trim(),
                    "opponentName" : opponent

                };
                createJSON(batsmanName,teamName[i],matchObj);
            }

           
        }

       // console.log("````````````````````````````````````````````````");
    }
    
    
}

//create json file for every player and if its already there then update the file
function createJSON(batsmanName,teamName,matchObj)
{
    let folderPath = path.join(__dirname,teamName);
    let filePath = path.join(folderPath,batsmanName + ".json");

    if(fs.existsSync(filePath)==false)
    {
        let arr = [];
        arr.push(matchObj);
        let createStream = fs.createWriteStream(filePath);
        createStream.end();
        fs.writeFileSync(filePath,JSON.stringify(arr));
    }
    else
    {
        fs.readFile(filePath,"utf-8",function(err,data){

            if(err)
            {
                console.log(err);
            }
            else
            {   
                var json = JSON.parse(data);
               var arr = [];
                for(let i = 0 ; i < json.length ; i++)
                {
                    arr.push(json[i]);
                }
                arr.push(matchObj);
            

                fs.writeFileSync(filePath,JSON.stringify(arr));

            }
        });
    }
    
}