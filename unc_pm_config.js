/*
	i2b2@UNC Custom Extensions - PM Config File
	@desc : Customizeable settings for PM custom messages and displays
	@author : Robert Bradford, University of North Carolina at Chapel Hill
	@source : https://github.com/NCTraCSIDSci/i2b2-UNC-Module/
	@changelog : 
		0.1.7 - [07.18.2019] Release version from internal UNC build.
	
*/

i2b2.UNC.PM.alerts.maintenance.timingConfig = {
	year : 2020,
	month : 4,
	day : 31,
	hour : 9,
	am_pm : 'AM',
	lengthHours : 12,
	lengthDays : 0
};

i2b2.UNC.PM.alerts.maintenance.message = 'i2b2 will be unavailable while undergoing scheduled maintenance on <span class="alertDate"> {MAINT_START_DATE} at {MAINT_START_TIME}</span> and expected to complete by <span class="alertDate"> {MAINT_END_DATE} at {MAINT_END_TIME}</span>';

i2b2.UNC.PM.alerts.holiday.timingConfig = {
	year : 2020,
	month : 4,
	day : 31,
	hour : 9,
	am_pm : 'AM',
	lengthHours : 0,
	lengthDays : 7
};
i2b2.UNC.PM.alerts.holiday.message = '<p> Begining {HOLIDAY_START_DATE} i2b2@UNC will be under limited support during the holiday season and continue through {HOLIDAY_END_DATE}.'
	+ ' Issues or questions concerning the application may not be responded to until service returns.'
	+'</p>';

i2b2.UNC.PM.login.announce = '<p class="login-announce-welcome">Welcome to i2b2!</p>'
	+'<p>Put a display message here to let users know what''s going on with the system. For example, remember to CITE your grant!</p>';

i2b2.UNC.PM.login.dialog = '<div id="i2b2_login_modal_dialog" class="UNC-Custom-Panel" style="display:block;">\n'+
'	<div class="hd UNC-Custom-Panel-Head">'+i2b2.UI.cfg.loginHeaderText+'</div>\n'+
'	<div class="bd login-dialog">\n'+
'		<form name="loginForm" style="margin:0;padding:0;" onsubmit="i2b2.PM.doLogin(); return false;">\n'+
'			<div id="loginMessage">Login incorrect or host not found.</div>\n'+
'			<div class="formDiv">\n'+
'				<div class="label">'+i2b2.UI.cfg.loginUsernameText+'</div>\n'+
'				<div class="input"><input type="text" name="uname" id="loginusr" value="'+i2b2.UI.cfg.loginDefaultUsername+'" size="20" maxlength="50" /></div>\n'+
'				<div class="label">'+i2b2.UI.cfg.loginPasswordText+'</div>\n'+
'				<div class="input"><input type="password" name="pword" id="loginpass" value="'+i2b2.UI.cfg.loginDefaultPassword+'" size="20" maxlength="50" /></div>\n'+
'				<div class="label">'+i2b2.UI.cfg.loginHostText+'</div>\n'+
'				<div class="input"><select name="server" id="logindomain"><option value="">Loading...</option></select></div>\n'+
'				<div class="button"><input type="button" value="  Login  " onclick="i2b2.PM.doLogin()" /></div>\n'+	
'			</div>\n'+
'		</form>\n'+
'	</div>\n'+
'	<div class="bd login-announce">' + i2b2.UNC.PM.login.announce + '</div>';

i2b2.UNC.PM.alerts.system.active = true;
i2b2.UNC.PM.alerts.system.options = {
		title: 'Known Bug Notice',
		message: 'We''re experiencing an error in the system and currently investigating.'
}

