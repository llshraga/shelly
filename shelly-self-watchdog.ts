// WARNING :
//  This script currently assumes you have another script present on the same
//  device and that script has ID : 2. Will be fixed later. 
//  That script will be used as the logger pad for persistent storage
//  I find it usefull to name that script "log" and mark it as NOT enabled, of course

// Each 10 minutes the script will start a session of 5 internet (and wifi) checks - each 10 secs apart
// if all 5 checks failed - the script will reboot Shelly
// PRO TIP : I have another script which is "enabled" (i.e - runs on boot) and sends me a Telegram message 
// that says Shelly was reboot 


// CONFIG START
// a remote URL with just a few bytes of content in order to check if internet is still available.
let remoteurl = 'https://gist.githubusercontent12.com/eurich/6e84e85c11401c4e28a2676492d846b7/raw/5d577bc2dfadfa13887f9b2ec146fe1b2ee2f5b6/gistfile1.txt';
// number of times the check is done before internet is considered as down.
let maxfails = 5;
// checks the internet connection every x minutes, recommended is 5 or more
let interval = 5;

let is_check_on_going = false;

// CONFIG END


// no need to change anything below this line.
let alertTimer = '';
let failcounter = 0;
function startMonitor() {
    alertTimer = Timer.set(interval *2 * 1000,
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


function addToLog(message)
{
    print(message);
   Shelly.call("Script.PutCode", 
                  {
                      id: "2",
                      append:true,
                      code:message + "\n\r"
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
                          // if we had some failures but now we got a connection
                          // reset the failures counter so we dont reboot too often
                          if (failcounter > 0 )
                          {
                               addToLog("Connected !");
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
    Shelly.call(
        "Shelly.Reboot",
        null,
        function (result, code, msg, ud) {
        },
        null
    );
}
startMonitor();
