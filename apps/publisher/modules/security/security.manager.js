/*
Description: The class is used to manage the security aspects of the app
Created Date: 5/10/2013
Filename: security.manager.js
 */
securityManagementModule=function(){

    var APP_SECURITY_MANAGER='security.manager';
    var provider=require('/modules/security/url/url.security.provider.js').securityModule();
    var log=new Log('security.manager');

    function SecurityManager(){
        this.provider=provider;
    }


    /*
    The function is used to perform security checks
     */
    SecurityManager.prototype.check=function(){

        var passed=false;
        //Checks whether the request can be handled
        if(this.provider.isPermitted()){
            log.info('passed the security check.');

            this.provider.onSecurityCheckPass();

            passed=true;
        }
        else{
            log.info('failed the security check.');
            this.provider.onSecurityCheckFail();
        }

        return passed;
    }

    /*
    The function is used to obtain a cached copy of the
    SecurityManager
     */
    function cached(){
       //var instance=application.get(APP_SECURITY_MANAGER);

       //Checks if an instance exists
       //if(!instance){
           instance=new SecurityManager();
       //}

       return instance;
    }

    return {
        SecurityManager:SecurityManager,
        cached:cached
    }
}

