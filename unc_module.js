/*
	i2b2@UNC Custom Extensions
	@desc : Central file of functions to extend the base functionality of i2b2. 
			These are changes that cannot easily be integrated using a plugin, but instead modify the core code itself to improve user experience.
	@author : Robert Bradford, University of North Carolina at Chapel Hill
	@source : https://github.com/NCTraCSIDSci/i2b2-UNC-Module/
	@changelog : 
		0.1.7 - [07.18.2019] Release version from internal UNC build.
	
*/

i2b2.UNC = {};
i2b2.UNC.CRC = {};
i2b2.UNC.ONT = {};
i2b2.UNC.PM = {};
i2b2.UNC.GEN = {};


i2b2.UNC.version = '0.1.7';

/******************************
 * CRC Custom Functions
 * - Items that apply directly to components of the CRC cell
 ******************************/
/*
 * CRC Config Options
 * @ maskZero : Are users allowed to see values of 0? Yes = false
 * @ permittedRoles : i2b2 user roles that are allowed to see ALL values (bypass all obfuscation)
 * @ lowThresholdStyle : Numeric value that will color result values Yellow if they are non Zero 
 * 		and less than the value of lowThresholdStyle. Set to 0 to bypass
 */
i2b2.UNC.CRC.config = {
		maskZero: false ,
		lowThresholdStyle: 25,
		permittedRoles: ["DATA_LDS"," DATA_PROT"]
};

/* 	Component: CRC Result Processor 
 * 	Replaces the default obfuscation methods of the i2b2 webclient. 
 * 	See ReadMe for details on the places this function should be called within the CRC cell.
 */
i2b2.UNC.CRC.resultProcessor = {
	maskZero: i2b2.UNC.CRC.config.maskZero,
	lowThresholdStyle: i2b2.UNC.CRC.config.lowThresholdStyle
};

/*
i2b2.UNC.CRC.resultProcessor.validResultDisplay
	@desc : Overrides the base i2b2 result masking functionality. Applies color highlighting and appropriate masking of values based on user roles and config parameters.
	@param [value] : Query result value (text or numeric)
	@param [roles] : User roles from PM cell
	@return : string value of the approved numeric result to display
*/
i2b2.UNC.CRC.resultProcessor.validResultDisplay = function(value, roles = []) {
	var retDisplay = "";
	if(value.indexOf('Less Than') >= 0)
		retDisplay = value
	else {
		var set_size = parseInt(value, 10);
		var higherMask = i2b2.UNC.PM.hasRole(i2b2.UNC.CRC.config.permittedRoles, roles) ? false : true;
		
		if (isNaN(set_size))
				retDisplay = "Unknown Value";
		else {
			if(!i2b2.PM.model.isObfuscated && !i2b2.UI.cfg.useFloorThreshold) {
				if (set_size == 0 && this.maskZero)
					retDisplay = "0";
				else
					retDisplay = set_size.toString();
			}
			else if (set_size > 0){
				if(i2b2.UI.cfg.useFloorThreshold && set_size < i2b2.UI.cfg.floorThresholdNumber && !i2b2.PM.model.isObfuscated && higherMask) 
					retDisplay = i2b2.UI.cfg.floorThresholdText + i2b2.UI.cfg.floorThresholdNumber.toString();
				else
					retDisplay = set_size.toString();
				
				if(i2b2.PM.model.isObfuscated && higherMask) {
					if(i2b2.UI.cfg.useFloorThreshold && set_size < i2b2.UI.cfg.floorThresholdNumber) 
						retDisplay = i2b2.UI.cfg.floorThresholdText + i2b2.UI.cfg.floorThresholdNumber.toString();				
					else 
						retDisplay = set_size.toString()+"&plusmn;"+i2b2.UI.cfg.obfuscatedDisplayNumber.toString();					
				}
			}
			else {
				retDisplay = "0";
			}
		}
	}
	return retDisplay;
};

/*
i2b2.UNC.CRC.resultProcessor.resultDisplayStyle
	@desc : Applies styling to a user's results to help emphasize good/bad query results.
	@param [value] : Query result value (text or numeric)
	@return : string value of the appropriate CSS class to apply to the query result
*/	
i2b2.UNC.CRC.resultProcessor.resultDisplayStyle = function(value) {
	var crcResType = 'crcCountResGood';
	if(!isNaN(value)) {
		if (value == 0) 
			crcResType = 'crcCountResZero';
		else if (value < i2b2.UNC.CRC.config.lowThresholdStyle && i2b2.UNC.CRC.config.lowThresholdStyle > 0) 
			crcResType = 'crcCountResLow';
	}
	else if (value.indexOf('Less Than') >= 0) {
		crcResType = 'crcCountResLow';
	}
	return crcResType;
};

/*
i2b2.UNC.CRC.queryConceptCheck
	@desc : Checks a panel which a concept is being dropped to ensure that the concept is not a duplicate (either exact or synonym) of a concept that has already been dropped in the group. 
		Also checks to see if the dropped concept is nested within a folder that is already present.
	@param [sdxConcept] : Concept being dropped onto the query group
	@param [itemList] : List of existing concepts within the query group
 */
i2b2.UNC.CRC.queryConceptCheck = function(sdxConcept, itemList) {
	var existingConceptErrorCode = -1; //Indicator for the type of collision identified with the concept (-1 = None , 0=Duplicate , 1=Synonym Clash, 2=Parent Clash, 3=Child Clash)
	var errorConceptNames = []; //Will be used to store the name of the parent Folder for the concept if found in the group
	//[I2-14] Bug Fix - Renamed for Clarity throughout, converted to array for easier management of names to display
	
	var msgRes = true;
	var error_concept_1;
	var error_concept_2;
	
	/* function: findParent 
	 * input: 	existObj - the existing object already in the panel
	 * 			newObjParent - The parent of the new object being selected and dropped
	 * 			order - The order in which the search is performed
	 * 				1 : A parent concept may have been dropped into a group with a child
	 * 				2 : A child concept may have been dropped into a group with a parent
	 * output:	Object with 2 properties = 	[existingConcept] 	: The score of the test (0 if there is no match, 
	 * 											3 if there is a match for parent dropped on child
	 * 											2 if a match for child dropped on parent)
	 * 										[parentFolder] 		: The name of the folder if there is a match
	 * This function was modified to resolve [I2-14]
	 */
	findParent = function(childObj,parentObj,order){
		// If the currObject path equals the path of the new objects parent we have a clash */
		if (parentObj.key == childObj.key || parentObj.dim_code==childObj.dim_code) {
			var childName = childObj.name;
			var parentName = parentObj.name;
			if (order == '1') {
				return {existingConceptErrorCode: 3, errorChildName: childName, errorParentName: parentName};
			}
			else {				
				return {existingConceptErrorCode: 2, errorChildName: childName, errorParentName: parentName};
			}
		}
		//if the parent is a container, containers cannot be added to the query so we are done */
		else if(parentObj.hasChildren=='CA' || parentObj.parent === undefined || childObj.hasChildren == 'CA')
			return {existingConceptErrorCode: -1, errorChildName: 'N/A', errorParentName: 'N/A'};
		//Continue through the tree
		else
			return findParent(childObj.parent,parentObj,order);
			
	}
	/* function: getBasecodes
	 * input: 	sdxObj - any SDX Object that has a basecode or dim_code
	 *			operator - The operator used when querying for a concept;
	 *			To address cases where a c_dimcode contains several concept_cd for an 'IN' clause
	 * output:	Array of objects = 	[n]={basecode,codesource}
	 * 									basecode	:	Contains the relevant basecodes to be searched for clashes
	 * 									codeSource	:	Identifies if the basecode came from the concept that was dragged
	 * 															or the c_dimcode of the concept that was dragged
	 */
	getBasecodes = function(sdxObj,operator,sdxType) {
		var codeList = [];
		var c_basecode;
		var c_dimcode;
		var c_modifier;
		if (sdxObj.basecode !== undefined) 
			c_basecode = sdxObj.basecode.trim();
		// [I2-328] Bug Fix - Resolves issue with modifier matching
		else if(sdxObj.basecode == undefined && sdxObj.isModifier == true && sdxObj.parent.parent.basecode !== undefined) {
			c_basecode = sdxObj.parent.parent.basecode.trim();
			var re = /\\[a-zA-Z0-9\_\:]{1,}\\/g;
			c_modifier = sdxObj.key.match(re);
			c_modifier = c_modifier[c_modifier.length-1];
		}
		else
			c_basecode = sdxType + ':NO BASECODE';
		
		codeList.push({
			basecode: c_basecode,
			codeSource : 'BASECODE'
		});
		// [I2-328] Bug Fix - Resolves issue with modifier matching
		if (sdxObj.isModifier == true)
		{
			codeList.push({
				basecode: c_modifier,
				codeSource: 'MODIFIER'
			});
		}
		
		if (sdxObj.dim_code !== undefined) {
			c_dimcode = sdxObj.dim_code.trim();
		}
		else
		{
			var c_key = sdxObj.key;
			var tempDimCode;
			if(c_key.indexOf('\\\\') == 0)
			{
				tempDimCode = c_key.substring(c_key.indexOf("\\",2));
				tempDimCode = tempDimCode.trim();
			}
			else {
				tempDimCode = c_key;
			}
			c_dimcode = tempDimCode;
		}
		var dimcodeSource;
		if(c_dimcode.trim().toUpperCase() !== c_basecode.trim().toUpperCase() && sdxObj.isModifier == false) {
			var dimList = [];
			if(operator.trim().toUpperCase() == 'IN'){ //[I2-12] BUG FIX: Modifiers do not have operator
				if(c_dimcode.charAt(0) == '(')
					c_dimcode = c_dimcode.slice(1);
				if(c_dimcode.charAt(c_dimcode.length-1) == ')')
					c_dimcode = c_dimcode.slice(0,c_dimcode.length-2);
				c_dimcode = c_dimcode.replace(/'/g,'');
				dimList = c_dimcode.split(',');
				dimcodeSource = 'IN';
				console.log(dimList);
			}
			
			else if(operator.trim() == '=') { //[I2-12] BUG FIX: Modifiers do not have operator
				dimList.push(c_dimcode.replace(/'/g,''));
				dimcodeSource = 'EQ';
			}
			
			len = dimList.length;
			for(var i= 0; i < len; i++) {
				codeList.push({
					basecode: dimList[i],
					codeSource : dimcodeSource+'-DIMCODE'
				});
			}
		}
		
		return codeList;
	}
	getDimCodeCount = function(dimList){
		var dimCodeCount = 0;
		for(d=0; d < dimList.length; d++){
			if(dimList[d].codeSource.indexOf('DIMCODE')>0 && dimList[d].basecode !== undefined){
				dimCodeCount++;
			}
		}
		return dimCodeCount;
	}
	/* Check to see if user is dropping a previous query into a group. Prevent that and notify to save patient set */

	if(sdxConcept.sdxInfo.sdxControlCell == 'CRC' && sdxConcept.sdxInfo.sdxType == 'QM') {
		var e = i2b2.UNC.CRC.errors.previousQuery;		
		msgRes = false;
	} 
	
	/* only need to check the panel if there are concepts already added */
	// BUG FIX : Check the sdxControl Cell to only process ONT items, ignore patient sets and queries. Need a more robust fix
	else if(itemList.length > 0 && sdxConcept.sdxInfo.sdxControlCell == 'ONT') {
		var newBasecodes = getBasecodes(sdxConcept.origData,sdxConcept.origData.operator,'NEW'); //Function returns complete list of basecodes and concept_cd that may be queried
		var newDimCount = getDimCodeCount(newBasecodes);
		
		for(var i=0; i < itemList.length; i++) {
			if(existingConceptErrorCode > -1 ) { break; } //[I2-14] Bug Fix
			// BUG FIX : Check the sdxControl Cell to only process ONT items, ignore patient sets and queries. Need a more robust fix
			if (itemList[i].sdxInfo.sdxControlCell == 'ONT') {
			// Check to see if the exact same concept is already in the panel -- Handles synonym cases
				var existingBasecodes;
				var existingKeyValue = itemList[i].sdxInfo.sdxKeyValue;
				var existingDisplayName = itemList[i].sdxInfo.sdxDisplayName;
				var newKeyValue = sdxConcept.sdxInfo.sdxKeyValue;
				var newDisplayName = sdxConcept.sdxInfo.sdxDisplayName;
				var re = /\\\\[a-zA-Z0-9\_]{1,}\\/;
				var existDomain = re.exec(existingKeyValue);
//					re = /\\\\[a-zA-Z0-9\_]{1,}\\/g;
				var newDomain = re.exec(newKeyValue);
				
				if(itemList[i].origData.isModifier) {
					existingKeyValue  = itemList[i].origData.parent.key+'|'+ itemList[i].origData.name;
					existingDisplayName = itemList[i].origData.parent.parent.name+'|'+ itemList[i].origData.name;
				}
				if(sdxConcept.origData.isModifier) {
					newKeyValue = sdxConcept.origData.parent.key+'|'+ sdxConcept.origData.name;
					newDisplayName = sdxConcept.origData.parent.parent.name+'|'+ sdxConcept.origData.name;
				}
				error_concept_1 = newDisplayName;
				
				//BUG FIX: When using previous queries there is not as much information available for the concept. May require rework to find info from ONT cell.
				if(itemList[i].origData.operator !== undefined)
					existingBasecodes= getBasecodes(itemList[i].origData, itemList[i].origData.operator,'EXIST');
				else
					existingBasecodes=getBasecodes(itemList[i].origData , 'LIKE' ,'EXIST');
				
				var existDimCount = getDimCodeCount(existingBasecodes);
				
				//Found exact match on basecode or keyValue
				if((existingBasecodes[0].basecode == newBasecodes[0].basecode 
					&& existingBasecodes[0].codeSource=='BASECODE' 
					&& newBasecodes[0].codeSource=='BASECODE')
					|| (existingKeyValue==newKeyValue) ){
						// [I2-328] Bug Fix - Resolves issue with modifier matching
						if(itemList[i].origData.isModifier || sdxConcept.origData.isModifier){
							if (itemList[i].origData.isModifier && sdxConcept.origData.isModifier 
									&& existingBasecodes[1].basecode == newBasecodes[1].basecode 
									&& existingBasecodes[1].codeSource == 'MODIFIER' 
									&& newBasecodes[1].codeSource == 'MODIFIER') {
								if(existingDisplayName != newDisplayName) {
									existingConceptErrorCode = 1;
									error_concpet_2 = 'Syn:'+existingDisplayName;
								}
								else {
									existingConceptErrorCode = 0;
								}
							}
							//Existing item is a Folder/Leaf and the new item is a modifier
							else if (['FA','LA'].indexOf(itemList[i].origData.hasChildren) > -1 && !itemList[i].origData.isModifier){
								existingConceptErrorCode = 6;
								error_concept_2=existingDisplayName;
							}
							//Existing item is a modifier and the new item is a folder/leaf
							else if (['FA','LA'].indexOf(sdxConcept.origData.hasChildren) > -1 && !sdxConcept.origData.isModifier){
								existingConceptErrorCode = 7;
								error_concept_2 = existingDisplayName;
							}
						}
						else {
							if(existingDisplayName != newDisplayName) {
								existingConceptErrorCode = 1;
								error_concpet_2 = 'Syn:'+existingDisplayName;
							}
							else {
								existingConceptErrorCode = 0;
							}
						}
				}
				// Before doing additional key checks, confirm same domain. If not in same domain, path checks will all fail
				else if (existDomain[1] == newDomain[1])
				{
					if(existingKeyValue.indexOf(newKeyValue) !== -1 || newKeyValue.indexOf(existingKeyValue)!== -1){
						// Default to 3 because we saw a key clash
						//[I2-27] Bug Fix : Pre-define check to prevent error
						existingConceptErrorCode = 3;
						error_concpet_1 = sdxConcept.origData.name;
						error_concept_2 = itemList[i].origData.name;
					}
					
					
					// Check to see if the parent of the current concept is already added. Parents should be folder. 
					if(itemList[i].origData.hasChildren.substring(0,2)=='FA' 
						&& sdxConcept.origData.parent !== undefined && existingConceptErrorCode==3) {
						var hierarchyCheck = {};
						if((sdxConcept.origData.hasChildren.substring(0,2)=='LA' || itemList[i].origData.level > sdxConcept.origData.level) && itemList[i].origData.parent !== undefined) { //[I2-27] Bug Fix : Check for undefined
							//if Existing concept itemList[i] is a higher level, then it may be a child concept
							hierarchyCheck = findParent(itemList[i].origData.parent, sdxConcept.origData, '1');
						}
						else if (existDomain[0] == newDomain[0] && itemList[i].origData.level < sdxConcept.origData.level && sdxConcept.origData.parent !== undefined){
							//if Existing concept itemList[i] is a lower level, then it may be a parent concept
							hierarchyCheck = findParent(sdxConcept.origData.parent, itemList[i].origData,'2');
						}
						existingConceptErrorCode = hierarchyCheck.existingConceptErrorCode;
					}
					// Parent may already be in group
					else if(existingConceptErrorCode==3
								&& itemList[i].origData.level < sdxConcept.origData.level) {
						existingConceptErrorCode = 2; //[I2-27] Bug Fix
						error_concept_2 = existingDisplayName; 
					}
				}
				
				else if(existDimCount > 0 || newDimCount > 0) {
					for(var e=1; e < existingBasecodes.length; e++){
						for(var n=1; n < newBasecodes.length; n++){
							if(existingBasecodes[e].basecode == newBasecodes[n].basecode){
								errorConceptNames[0] = newDisplayName;
								// Handle cases where Synonyms are identified in the DIMCODE where only 1 DIMCODE value exists
								if (existingBasecodes[e].codeSource == 'EQ-DIMCODE' && newBasecodes[n].codeSource == 'EQ-DIMCODE' 
									|| (existDimCount == 1 && newDimCount == 1)){
									existingConceptErrorCode = (existingDiplayName == newDisplayName) ? 1 : 0;
									error_concept_2 = 'Syn:'+existingDisplayName;
								}
								
								else if(existingBasecodes[e].codeSource == 'IN-DIMCODE' && newBasecodes[n].codeSource == 'EQ-DIMCODE') {
									existingConceptErrorCode = 4;
								}
								else if (existingBasecodes[e].codeSource == 'EQ-DIMCODE' && newBasecodes[n].codeSource == 'IN-DIMCODE'){
									existingConceptErrorCode = 5;
									error_concept_2 = existingDisplayName;
								}
								/* Not sure if an IN-DIMCODE clash should be 
								else if (existingBasecodes[e].codeSource == 'IN-DIMCODE' && newBasecodes[n].codeSource == 'IN-DIMCODE' && (newBasecodes.length > 2 || existingBasecodes.length > 2)){
									existingConcept = 6
								}*/
							}
						}
					}
				}
			//Need to check to see if child concepts have been added - should be done by dim_code?
			//Work in Progress
			//else if(sdxConcept.sdxInfo.sdxKeyValue itemList[i].sdxInfo.sdxKeyValue.length)
			}
		}
		
		if(existingConceptErrorCode > -1){ //[I2-14] Bug Fix
			var e = i2b2.UNC.CRC.errors.existingConcept[existingConceptErrorCode];
			if (sdxConcept.origData.basecode !== undefined && ((sdxConcept.origData.basecode.indexOf('CPT')>=0 
					|| sdxConcept.origData.basecode.indexOf('ICD')>=0 
					|| sdxConcept.origData.basecode.indexOf('HCPCS')>=0)) && !sdxConcept.origData.isModifier){ 
				error_concept_1 = sdxConcept.origData.basecode; //Only use the basecode/concept code in certain circumstances - ICD/CPT codes are well understood by users
			}
			msgRes = false;
		}
		//Check to see if the error box already exists
		if (!msgRes && e !== undefined) {
			if (!i2b2.UNC.CRC.ErrorDialog) {
			//handelCanel must be defined for the error box
				i2b2.UNC.CRC.ErrorDialog = i2b2.UNC.GEN.ErrorDialog()
				i2b2.UNC.CRC.ErrorDialog.render(document.body);
			}
			var alertMessage = '<div style="text-align:center; padding-bottom:10px;font-weight:bold;">i2b2 encountered a problem when adding a concept:</div>'+e.message;
			alertMessage = alertMessage.replace(/{ERROR_CONCEPT_1}/g,error_concept_1);
			alertMessage = alertMessage.replace(/{ERROR_CONCEPT_2}/g,error_concept_2);
			$j('#UNCQueryErrorTitle').html(e.title);
			$j('#UNCAlertMsg').html(alertMessage);
			$j('#UNCQueryError').show();
			i2b2.UNC.CRC.ErrorDialog.center();
			i2b2.UNC.CRC.ErrorDialog.show();
		}
	}
	
	return msgRes
};

i2b2.UNC.CRC.setDemographicConceptFlag = function(sdxConcept){
	//UNC Custom Mod - Same Encounter applied to Demographic Values
	//Set a value for demographic value (no encounter tie)
	var table_name = '';
	if (sdxConcept.origData.hasOwnProperty('table_name') && sdxConcept.origData.table_name !== undefined) {
		table_name = sdxConcept.origData.table_name.toUpperCase();
	} else { // lookup table_name
		if (sdxConcept.sdxInfo.sdxControlCell == 'ONT') {
			var results = i2b2.ONT.ajax.GetTermInfo("ONT", { ont_max_records: 'max="1"', ont_synonym_records: 'false', ont_hidden_records: 'false', concept_key_value: sdxConcept.origData.key }).parse();
			if (results.model.length > 0) {
				table_name = results.model[0].origData.table_name.toUpperCase();
			}
		}
	}

	if (table_name == 'PATIENT_DIMENSION') {
		return true;
	}
	else {
		return false;
	}
};

/*
	Errors associated with the CRC cell. May be specific to added functionality or clarifications/override of base i2b2 errors in the CRC cell.
*/
i2b2.UNC.CRC.errors = {};
i2b2.UNC.CRC.errors.previousQuery = {
			title : 'Previous Query Usage',
			message: '<div style="text-align:center; padding-bottom:10px;font-weight:bold;">i2b2 encountered a problem when adding an object:</div>'
				+' We noticed you tried to drop a previously ran query into a group. Re-using an entire query causes queries to take significantly longer to complete.'
				+ '<br><br><b>If you want to use the patients returned from a specific query:</b> Please re-execute that query separatly and save a "Patient Set" when selecting result types. After completing, the patient set returned can be used in subsequent queries.'
				+ '<br><br><b>If you want to re-execute a previous query to see if a value has changed since the last time it was executed:</b> Please Drag-and-Drop the query onto the "Query Name" box.'
};

i2b2.UNC.CRC.errors.existingConcept = [
	{//0
		title: "Duplicate Concepts",
		message: "You already have a copy of <i>'{ERROR_CONCEPT_1}'</i> in this group. We've prevented you from adding it twice."
	},
	{//1
		title: "Synonym Concepts",
		message: "You already have a copy of <i>'{ERROR_CONCEPT_1}'</i> in this group. We've prevented you from adding it twice.<br><br>Existing Synonym in Group: <i>'{ERROR_CONCEPT_2}'</i>"
	},
	{//2
		title: "Nested Concepts",
		message: "You have the <i>'{ERROR_CONCEPT_2}'</i> folder in this group, which already contains <i>'{ERROR_CONCEPT_1}'</i>.<br><br> We've prevented you from adding it twice."
	},
	{//3
		title: "Nested Concepts",
		message: "You already have  <i>'{ERROR_CONCEPT_2}'</i> in this group, which is nested inside the <i>'{ERROR_CONCEPT_1}'</i> folder you attempted to add.<br><br> If you'd like to add the whole folder, delete <i>'{ERROR_CONCEPT_2}'</i> from the group and try again."
	},
	{//4
		title: "Nested Concepts",
		message: "You already have  <i>'{ERROR_CONCEPT_2}'</i> in this group, which is querying a group of concepts that already includes <i>'{ERROR_CONCEPT_1}'</i><br><br> We've prevented you from adding it twice."
	},
	{//5
		title: "Grouped Concepts",
		message: "You have <i>'{ERROR_CONCEPT_2}'</i> which is a concept that is included in the grouped concept, <i>'{ERROR_CONCEPT_1}'</i> you attempted to add. <br><br>If you'd like to add the grouped concept, delete <i>'{ERROR_CONCEPT_2}'</i> from the group and try again."
	},
	{//6
		title: "Modifier Nesting",
		message: "You attempted to add <i>'{ERROR_CONCEPT_1}'</i> which is a modifier that is included in the grouped concept <i>'{ERROR_CONCEPT_2}'</i>. <br><br>If you'd like to add the modifier, delete <i>'{ERROR_CONCEPT_2}'</i> and try again."
	},
	{//7
		title: "Modifier Nesting",
		message: "You have <i>'{ERROR_CONCEPT_2}'</i> which is a modifier that is included in the grouped concept, <i>'{ERROR_CONCEPT_1}'</i> you attempted to add. <br><br>If you'd like to add the grouped concept, delete <i>'{ERROR_CONCEPT_2}'</i> and try again (this will remove the modifier condition)."
	},
];

/******************************
 * PM Custom Functions
 * - Items that apply directly to PM settings or attributes of the current user
 ******************************/
/*
i2b2.UNC.PM.hasRole 
	@desc : Checks a users list of roles fpr a specific role.
	@param [role] : Input role to find
	@param [roles] : Array of user roles from PM cell
	@return : boolean
*/
i2b2.UNC.PM.hasRole = function (role, roles) {
	if (roles.length == 0)
		return false
	else if (roles.indexOf(role) == -1)
		return false;
	else
		return true;
};
/*
i2b2.UNC.PM.alerts
	@desc : Defines various alert messaging to be used by the PM cell
*/
i2b2.UNC.PM.alerts = { maintenance : undefined, holiday : undefined, system : undefined,
		/*
		getTiming
		@desc : function to build date object for the start and end date of a PM alert to be displayed.
		@return : list of Date objects
		*/
		getTiming : function(window) {
			today = new Date();
			try {
				start_hour = (window.am_pm.toUpperCase() == 'AM') ? window.hour : window.hour + 12;
				start_date = new Date(window.year, (window.month -1) ,window.day, start_hour, 0,0,0);
				end_date = new Date(window.year, (window.month -1) ,window.day, start_hour, 0,0,0);
				end_date.setHours(end_date.getHours() + window.lengthHours);
				end_date.setDate(end_date.getDate() + window.lengthDays);
				if (today <= end_date) {
					return [start_date, end_date]
				}
				else {
					return []
				}
			}
			catch(err) {
				return []
			}
		}
};

/*
i2b2.UNC.PM.alerts.maintenance (object)
	@desc : defines the HTML structure and parameters used for displaying maintenance alerts. These alerts appear underneath the i2b2 login dialog.
	@note : actual message is defined in unc_pm_config
*/
i2b2.UNC.PM.alerts.maintenance =  {
	timingConfig : {},
	window : i2b2.UNC.PM.alerts.getTiming(this.timingConfig),
	html : '<div class="login-maint">\n'+
			'	<div class="Sys-Alert-Head">\n'+
			'		<div class="Sys-Alert-Head-Text">\n'+
			'			<span class="Sys-Alert-Icon UNCIcon">\n'+
			'				<img src="assets/unc_module/images/error.png">\n'+
			'			</span>\n'+
			'			<span >System Alert</span>\n'+
			'		</div>\n'+
			'	</div>\n'+
			'	<div class="Sys-Alert-Body">\n {MAINT_MESSAGE} '+ 
			'	</div>\n'+
			'</div>\n'
};

/*
i2b2.UNC.PM.alerts.holiday (object)
	@desc : defines the HTML structure and parameters used for displaying holiday alerts. These alerts appear underneath the i2b2 login dialog.
	@note : actual message is defined in unc_pm_config
*/
i2b2.UNC.PM.alerts.holiday = {
		timingConfig : {},
		html : '<div class="login-maint">\n'+
		'	<div class="Sys-Notice-Head-Holiday">\n'+
		'		<div class="Sys-Notice-Head-Text">\n'+
		'			<span class="Sys-Alert-Icon UNCIcon">\n'+
		'				<img src="assets/unc_module/images/help.png">\n'+
		'			</span>\n'+
		'			<span >Holiday Notice</span>\n'+
		'		</div>\n'+
		'	</div>\n'+
		'	<div class="Sys-Notice-Body">\n {HOLIDAY_MESSAGE}' + 
		'	</div>\n'+
		'</div>\n'
};

/*
i2b2.UNC.PM.alerts.system (object)
	@desc : defines the HTML structure and parameters used for displaying system alerts. These alerts appear underneath the i2b2 login dialog.
	@note : actual message is defined in unc_pm_config
*/
i2b2.UNC.PM.alerts.system = {
		active : false,
		html : '<div class="login-maint">\n'+
		'	<div class="Sys-Notice-Head">\n'+
		'		<div class="Sys-Notice-Head-Text">\n'+
		'			<span class="Sys-Alert-Icon UNCIcon">\n'+
		'				<img src="assets/unc_module/images/help.png">\n'+
		'			</span>\n'+
		'			<span >{ALERT_TITLE}</span>\n'+
		'		</div>\n'+
		'	</div>\n'+
		'	<div class="Sys-Notice-Body">\n {ALERT_MESSAGE}'+ 
		'	</div>\n'+
		'</div>\n'
};

/*
i2b2.UNC.PM.alerts.login (object)
	@desc : Overrides the cosntruction of the base i2b2 login dialog.
	@note : actual login panel is defined in unc_pm_config
*/
i2b2.UNC.PM.login = {
		dialog : '',
		draw : function() {
			in_maintenance = i2b2.UNC.PM.alerts.getTiming(i2b2.UNC.PM.alerts.maintenance.timingConfig);
			in_holiday = i2b2.UNC.PM.alerts.getTiming(i2b2.UNC.PM.alerts.holiday.timingConfig);
			in_alert = i2b2.UNC.PM.alerts.system.active;
			
			html = i2b2.UNC.PM.login.dialog;
			if (in_maintenance.length > 0) {
				m_html = i2b2.UNC.PM.alerts.maintenance.html;
				m_msg = i2b2.UNC.PM.alerts.maintenance.message;
				m_msg = m_msg.replace('{MAINT_START_DATE}', in_maintenance[0].toDateString()).replace('{MAINT_START_TIME}', i2b2.UNC.GEN.formatAMPM(in_maintenance[0]));
				m_msg = m_msg.replace('{MAINT_END_DATE}', in_maintenance[1].toDateString()).replace('{MAINT_END_TIME}', i2b2.UNC.GEN.formatAMPM(in_maintenance[1]));
				m_html = m_html.replace('{MAINT_MESSAGE}', m_msg);
				html = html + m_html;
			}
			
			if (in_holiday.length > 0) {
				h_html = i2b2.UNC.PM.alerts.holiday.html;
				h_msg = i2b2.UNC.PM.alerts.holiday.message;
				h_msg = h_msg.replace('{HOLIDAY_START_DATE}', in_holiday[0].toDateString()).replace('{HOLIDAY_START_TIME}', i2b2.UNC.GEN.formatAMPM(in_holiday[0]));
				h_msg = h_msg.replace('{HOLIDAY_END_DATE}', in_holiday[1].toDateString()).replace('{HOLIDAY_END_TIME}', i2b2.UNC.GEN.formatAMPM(in_holiday[1]));
				h_html = h_html.replace('{HOLIDAY_MESSAGE}', h_msg);
				html = html + h_html;
			}
			
			if (in_alert) {
				a_html = i2b2.UNC.PM.alerts.system.html;
				a_msg = i2b2.UNC.PM.alerts.system.options.message;
				a_title = i2b2.UNC.PM.alerts.system.options.title;
				a_html = a_html.replace('{ALERT_MESSAGE}', a_msg).replace('{ALERT_TITLE}', a_title);
				html = html + a_html;
			}
			
			return html;
		}	
	};

/******************************
 * ONT Custom Functions
 * - 
 ******************************/
i2b2.UNC.ONT.config = {
		dataDictionaryLink: true //Set true if supporting an external link to a larger data dictionary
};

/*
i2b2.UNC.ONT.Info
	@desc: UNC Ontology InfoButtons. Allow a quick reference for parent containers within the i2b2 ontology as well as direct link out to a local data dictionary (if available).
*/
i2b2.UNC.ONT.Info = {
	addButtons : function(objectList){
		for(var i = 0; i < objectList.length; i++) {
			if (objectList[i].branch == 'CA' && typeof objectList[i].concept != 'undefined') {
				var ontEle = $(objectList[i].htmlID); //document.getElementById(uncInfoArray[i]);
				parentEle = ontEle.closest("tr");
				parentEle.appendChild(i2b2.UNC.ONT.Info.dom(objectList[i].concept));
			}
		}
	},
	
	dom : function(link) {
		var iconUrl = 'assets/unc_module/images/information.png';
		var infoButton = document.createElement('td');
		infoButton.className='UNCInfo';
		infoButton.innerHTML = "<a onClick=i2b2.UNC.ONT.Info.button.show('"+link+"');><img src='"+ iconUrl+"'/></a>";
		return infoButton;
	},
	
	button : {
		show: function(dmn) {
			// Load the Help Popup
			$j.ajax({
				url:'dict/infobutton.html',
				type: "get",
				cache: false,
				success: function(response){
					dmnText = $j(response).filter("#"+dmn)
					if(!dmnText.length)
					{
						$j("#infoButton-viewer-head").html("<div>UNC InfoButton - Error</div>");
						$j("#infoButton-viewer-body").html("<div class='UNCErrorMsg'>We're sorry but there was an error loading the data for this domain to the UNC InfoButton.</div>");
						$j("#infoButton-viewer-body").append("<div class='UNCErrorCode'> Error Code: IFB-101-"+dmn.toUpperCase()+"</div>");
						return;
					}
					else
					{
						dmnTitle = dmnText.find(".title");
						dmnBody = dmnText.find(".body");
						dmnErrorCode = '';
						if(!dmnTitle.length || dmnTitle.is(":empty") || !dmnTitle.text().length){
							dmnTitle="UNC InfoButton";
							dmnErrorCode = "IFB-103-"+dmn.toUpperCase();
						}
						
						if(!dmnBody.length || dmnBody.is(":empty")){
							dmnBody = "<div class='UNCErrorMsg'>We're sorry but there was an error loading the data for this domain to the UNC InfoButton.</div>";
							dmnErrorCode = "IFB-102-"+dmn.toUpperCase();
						}
						
						$j("#infoButton-viewer-head").html(dmnTitle);
						$j("#infoButton-viewer-body").html(dmnBody);
						
						if(dmnErrorCode.length)
						{
							$j("#infoButton-viewer-body").append("<div class='UNCErrorCode'> Error Code: "+dmnErrorCode+"</div>");
						}
						
					}
				},
				error: function(){
					$j("#infoButton-viewer-head").append("<div>UNC InfoButton - Error</div>");
					$j("#infoButton-viewer-body").append("<div class='UNCErrorMsg'>We're sorry but there was an error loading the UNC InfoButton.</div>");
					$j("#infoButton-viewer-body").append("<div class='UNCErrorCode'> Error Code: IFB-404-"+dmn.toUpperCase()+"</div>");
	            }
			});
	
			if (!i2b2.UNC.ONT.Info.button.dialog) {
				var openDataDictionary = function() {
					//i2b2.hive.DictViewer.show(this.domain); -- Bypass show of internal until the web link is fixed
					i2b2.hive.DictViewer.outside(this.domain);
					this.cancel();
				};
				
				var infoButtonPanel = "infoButton-viewer-panel"
				var infoButtonDetails = {
					width: "400px",				
					height: "220px",
					autofillheight: "body",
					fixedcenter: false,
					constraintoviewport: true,
					buttons: []
				};

				if (i2b2.UNC.ONT.config.dataDictionaryLink) {
					var dataDictLink = {
						text: "Get More Info From UNC Data Dictionary",
						handler: {fn: openDataDictionary},
						isDefault: false
					};
					infoButtonDetails.buttons.push(dataDictLink);
				}
				i2b2.UNC.ONT.Info.button.dialog = i2b2.UNC.GEN.dialog(infoButtonPanel, infoButtonDetails);
				i2b2.UNC.ONT.Info.button.dialog.render(document.body);
				
				$j("#dict-viewer-panel .ft.UNC-Custom-Panel-Foot .button-group").addClass('center');
				
				$j("#infoButton-viewer-panel .hd.UNC-Custom-Panel-Head").height('30px');
				$j("#infoButton-viewer-panel .bd.UNC-Custom-Panel-Body").height('127px');
				$j("#infoButton-viewer-panel .ft.UNC-Custom-Panel-Foot").height('50px');
				
				$j("#infoButton-viewer-panel .bd.UNC-Custom-Panel-Body").css('overflow-y','auto');	
				$j("#infoButton-viewer-panel").show();
			} 
			else {
				i2b2.UNC.ONT.Info.button.dialog.domain = dmn;
				$j("#infoButton-viewer-panel .bd.UNC-Custom-Panel-Body").scrollTop();
				i2b2.UNC.ONT.Info.button.dialog.show();
			}
		
		},
		hide: function() {
			try {
				i2b2.UNC.ONT.Info.button.dialog.hide();
			} catch (e) {}
		}
	}
};
/*
i2b2.UNC.GEN.dialog
	@desc: Standard construct function for dialog boxes. Allows for easy creation of new/more error or alert messages as needed/
	@param [panel]: the Panel to be created
	@param [attributes]: Customized attributes for the dialog
	@return: YAHOO.widget.Dialog
*/
i2b2.UNC.GEN.dialog = function(panel, attributes) {

	var handleCancel = function() {
		this.cancel();
	};
	
	var details = {
			width: ("width" in attributes) ? attributes["width"] : "400px",
			height: ("height" in attributes) ? attributes["height"] : "220px",
			autofillheight: ("fillheight" in attributes) ? attributes["fillheight"] : "body",
			fixedcenter: ("fixedcenter" in attributes) ? attributes["fixtedcenter"] : false,
			constraintoviewport: ("constraintoviewport" in attributes) ? attributes["constraintoviewport"] : true,
			zindex: 700,
			buttons: [{
				text: "Close",
				handler: handleCancel,
				isDefault: false
			}]
	};
	
	if ("buttons" in attributes && attributes.buttons.length > 0) {
		for (var b in attributes.buttons) {
			if (attributes.buttons.hasOwnProperty(b))
				details.buttons.push(attributes.buttons[b]);
		}
	}
	
	var newDialog = new YAHOO.widget.Dialog(panel, details);
	return newDialog;
		
};

/*
i2b2.UNC.GEN.formatAMPM
	@desc: generic function to convert a date into a fully formated AMPM timestamp
*/
i2b2.UNC.GEN.formatAMPM = function(date) {
	var hours = date.getHours();
	var minutes = date.getMinutes();
	var ampm = hours >= 12 ? 'pm' : 'am';
	hours = hours % 12;
	hours = hours ? hours : 12; // the hour '0' should be '12'
	minutes = minutes < 10 ? '0'+minutes : minutes;
	var strTime = hours + ':' + minutes + ' ' + ampm;
	return strTime;
};

/*
i2b2.UNC.GEN.ErrorDialog
	@desc: Generic constructor for error dialogs.
*/
i2b2.UNC.GEN.ErrorDialog = function() {
	var uncErrorObject = "UNCQueryError";
	var attributes = { 
			width: "400px",
			height: "",
			fixedcenter: true,
			constraintoviewport: true,
			modal: true,
			zindex: 700}

	return i2b2.UNC.GEN.dialog(uncErrorObject, attributes);
};
