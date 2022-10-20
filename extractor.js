const puppeteer = require('puppeteer');
const mysql = require('sync-mysql');
const config = require('config');
var appConfig;
var connection;


//DATA
const site_user = '';
const site_password = '';

var day_manager_count = 0;


(async () => {
    console.log("*** Demarrage Extractor\n");

    let iPause = getRandomArbitrary(3*60*1000, 14*60*1000);
    iPause += getRandomArbitrary(1*1000, 60*1000);
    console.log("-> temporisation de démarrage : "+ Math.round(iPause/60/1000)+ " minutes");

    iPause=50;
    await sleep( iPause );


    appConfig = config.get('app');
    const dbConfig = config.get('db');
    connection = new mysql({
        host     : dbConfig.host,
        database : dbConfig.database,
        user     : dbConfig.user,
        password : dbConfig.password
    });


    const result = connection.query("SELECT count(*) as countmanager FROM manager where date_extract = CURDATE()");
    day_manager_count = result[0].countmanager;
    console.log("-> Manager déjà enregistré ce jour : "+day_manager_count+"\n");

    /*if (day_manager_count>appConfig.max_daily) {
        console.log("-> Quota ("+appConfig.max_daily+") atteint, fin de programme");
        process.exit(0);
    }*/

    //launch
    const browser = await puppeteer.launch({ headless: false, slowMo: 30, defaultViewport: {width:1420,height:1080}, args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1420,1080'] });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4427.0 Safari/537.36');

    await page.goto('https://lecercle.in/accueil-entreprises-de-management-de-transition-et-autres-acteurs/');

    console.log("*** Connexion au site")

    //LOGGED OR NOT ?
    const login_link = 'li#menu-item-245 > a';
    if (await page.$(login_link) !== null) {
        //non connecté
        var links = await page.$(login_link);
        await links.click();
        await page.waitForSelector('input[name=username-26]');
        await page.type('input[name=username-26]', site_user, {delay: 20})
        await page.type('input[name=user_password-26]', site_password, {delay: 20})
        //Check si connexion est disponible
        try {
        await page.click('input[id="um-submit-btn"]');

        } catch (error) {
            console.log("Erreur de connexion");
            process.exit(1);
        }
        console.log("*** Ouverture de la page manager");
        await page.waitForSelector('li#menu-item-242 > a');
        await page.click('li#menu-item-242 > a')
    }

    //Direction les manager
    /*var maxmanagerCount = getRandomArbitrary(appConfig.min_session_manager, appConfig.max_session_manager);
    var iCountmanager = 0;*/

    await page.waitForSelector('.um-member-name > a'); 
    let elems = await page.$$('.um-member-name > a');

    console.log("*** Extraction des profils\n");

    for(var i=0; i<elems.length; ++i)
    {
        data_url = (await elems[i].getProperty('href')).toString().substring(9);

        await page.goto(data_url);

        let data_email = await page.evaluate(() => {
            if(document.querySelector('#user_email-74') == null)
            {
                return null
            }
            return document.querySelector('#user_email-74').innerText
        });

        let data_tel = await page.evaluate(() => {
            if(document.querySelector('#mobile_number-74') == null)
            {
                return null
            }
            return document.querySelector('#mobile_number-74').innerText
        });

        let data_nom = await page.evaluate(() => {
            return document.querySelector('#last_name-74').innerText
        });
        
        let data_prenom = await page.evaluate(() => {
            return document.querySelector('#first_name-74').innerText
        });

        console.log("Url : "+data_url);
        console.log("Prénom : "+data_prenom);
        console.log("Nom : "+data_nom);
        console.log("Email : "+data_email);
        console.log("Tel : "+data_tel+"\n");

        const profils = connection.query('select url from manager where url = "'+data_url+'"');

        if(profils.length > 0)
        {
            console.log("*** Profil déjà en base -> Profil non enregistré\n") 
        }
        else if(data_email == null || data_tel == null){
            console.log("*** Données manquantes -> Profil non enregistré\n")
        }
        else{
            connection.query('insert into manager (url, prenom, nom, email, tel, date_extract) values ("'+data_url+'","'+data_prenom+'","'+data_nom+'","'+data_email+'","'+data_tel+'",curdate())');
            console.log("*** Insertion effectuée\n")
        }

        await sleep(10000);
        await page.goBack();

        if(i == 11)
        {
            await page.waitForSelector('i[class="um-faicon-angle-right"]');
            await page.click('i[class="um-faicon-angle-right"]');
            await sleep(10000);
            i = -1
            //await page.waitForSelector('.um-member-name > a'); 
            //elems = await page.$$('.um-member-name > a');
        }
        /*else
        {
            await page.waitForSelector('.um-member-name > a'); 
            elems = await page.$$('.um-member-name > a');
        }*/

        await page.waitForSelector('.um-member-name > a'); 
        elems = await page.$$('.um-member-name > a');
        
    }
    await sleep(getRandomArbitrary(2*60*1000, 6*60*1000));

    console.log("*** FIN");

    await browser.close();
})();


function getRandomArbitrary(min, max) {
    return Math.random() * (max - min) + min;
}

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}
