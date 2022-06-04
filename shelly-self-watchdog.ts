// a remote URL with just a few bytes of content in order to check if internet is still available.
let remoteurl = 'https://gist.githubusercontent.com/eurich/6e84e85c11401c4e28a2676492d846b7/raw/5d577bc2dfadfa13887f9b2ec146fe1b2ee2f5b6/gistfile1.txt';

// number of times the check is done before internet is considered as down.
let maxfails = 5;

// checks the internet connection every x minutes, recommended is 5 or more
let interval_secs = 10;

// critical section
let is_check_on_going = false;

// no need to change anything below this line.
let alertTimer = '';
let mainTimer = '';
let failcounter = 0;
let currentTime = '';
let firstTime = true;
let logScritID = 100;
let telegramRegainConnecionScriptID = 100;

function sendRegainTelegram()
{
    
  Shelly.call("Script.Stop", 
                    {
                        id: telegramRegainConnecionScriptID,
                     },
                      function (res, error_code, error_msg, ud) {
                          Shelly.call("Script.Start", 
                                      {
                                        id: "4",
                                       },
                                       function (res, error_code, error_msg, ud) {},
                                       null
                                       );
                        },
                    null
                );
}
function doMonitor()
{
    addToLog("Starting session");
    alertTimer = Timer.set(interval_secs * 1000,
        true,
        function () {
            // Simple critical section to make sure this timer is not faster
            // than the checks we are running (all is done asynchronously)
            if (is_check_on_going === false)
            {
              checkInternetandWifiOK();
            }        
        }
        null
    );

}

function startMonitor() {
   
     Shelly.call("Sys.GetStatus", {},
                   function(res, error_code, error_msg, ud)
                   {
                     currentTime = res.time;
                     print(currentTime); 
                     if (firstTime===true)
                     {
                       addToLog("Boot up");
                       firstTime = false;
                     }
                     doMonitor();
                   },
                   null,
                   );
}


function addToLog(message)
{
   print(message);
   Shelly.call("Script.PutCode", 
                  {
                      id: logScritID,
                      append:true,
                      code: currentTime + ":" + message + "\n"
                   },
                    function (res, error_code, error_msg, ud) {
                        
                      },
                  null
              );
}

function checkInternetandWifiOK()
{
    // Get the critical section to prevent two inqueres in parallel
   is_check_on_going = true;
    Shelly.call("HTTP.GET", 
                {
                    url: remoteurl,         
                 },
                  function (res, error_code, error_msg, ud) {
                      if (error_code !== 0)
                      {
                         addToLog("Internet not accesible");
                         
                         // So we failed accessing the site lets also check if Wifi is disconnected
                         checkWifiOK();
                      }
                      else
                      {
                          print("Connected. Stopping checks for 5 minutes");
                          is_check_on_going = false;
                          Timer.clear(alertTimer);
                          // if we had some failures but now we got a connection
                          // reset the failures counter so we dont reboot too often
                          if (failcounter > 0 )
                          {
                               addToLog("Connected !");
                               // Connection was lost and regain before we decided to reboot - notify the owner - me :)
                               sendRegainTelegram();
                              
                               failcounter = 0;
                          }
                          
                      }
                    
                    },
                null,
            );
 }

function checkWifiOK()
{
   Shelly.call("Wifi.GetStatus",
              null,
              function (res, error_code, error_msg, ud) 
              {
               
                 if ((res.status === "disconnected") || (res.status === "connecting"))
                 {
                    addToLog("WIFI not connected");
                 }  
                 // If we are here - the Internet connection failed
                 // Regardless of the wifi status we need to see if this is the time to reboot
                 
                 if (failcounter === maxfails) {
                    addToLog("Restart");
                    restartRelay();
                } else {
                    failcounter++;
                } 
                // Free the critical section for the next run
                is_check_on_going = false;        
              },
              null,
          );
}
function restartRelay() {
    // Self- reboot
    // Note : currently I have another script which is enabled to run on Boot and that scripts sends me a Telegram note about 
    // Shelly coming up of boot
    Shelly.call(
        "Shelly.Reboot",
        null,
        function (result, code, msg, ud) {
        },
        null
    );
}

function kickMonitor() {
    // Start 10 minutes timer - each 10 minutes we will perform a series of network checks 
    mainTimer = Timer.set(10 * 60 * 1000,
        true,
        function () {           
              startMonitor();
        }
        null
    );
}

function initAndRun()
{
    // First we are going to identify our utility scripts. There are two currently
    // One should be name "logs" and we will use it as a pseudo-script to store persisten execution logs 
    // since I did not find another way in the API to store persisten logs
    // Second script is named TelegramRegainConnection - this one, when executed, will send me a Telegram message
    // and it will be triggered if the connection was identified as lost and regained  before the shelly decided to self-reboot
    
    // Note : no error handling in the scripts identification part for now. I just assume they exist
  Shelly.call("Script.List",{},
              function (res, error_code, error_msg, ud) 
              {
                for (let i=0; i<res.length; i++) {
                    if (res[i].name === "log")
                    {
                      print("Log script");
                      logScritID = res[i].id;
                      print(logScritID);
                    }
                    else if (res[i].name === "TelegramRegainConnection")
                    {
                      print("TelegramRegainConnection script");
                      telegramRegainConnecionScriptID = res[i].id;
                      print(telegramRegainConnecionScriptID);
                    }
               }
      
               // Scripts identification is done - start the main timer
               kickMonitor();
    
              },null
               );
}

initAndRun();
