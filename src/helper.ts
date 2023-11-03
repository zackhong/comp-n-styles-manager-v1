function delay(timeInMs:number){
    return new Promise( (resolve)=> setTimeout(resolve, timeInMs) );
}

function findIndices(str:string, refChar:string){

    let indexes = [];

    for (let i = 0; i < str.length; i++) {
        if (str[i] == refChar) {
            indexes.push(i);
        }
    }

    return indexes;
}

export function getTextStyles(){

    let names;
    let indices;

    const textStyles = figma.getLocalTextStyles();

    for (const style of textStyles){
        
        //construct folders based on style's full name
        names = style.name.split("/");

        //construct folders for style if style is nested in folders ie there is "/" in its name
        if(names.length > 1){

            //we want to set folder paths as its id eg "C" folder in "A/B/C/D" will have id as "A/B/C"
            //parent folder "B" will have id "A/B"
            indices = findIndices(style.name, "/");

            for(let i = 0; i < names.length; i++){

                //build root folder with first name
                if(i == 0){
                    figma.ui.postMessage({type:"folder-text", id:names[i], name:names[i], parent:"result-text"});
                }
                //build child folders with ref to parent folder
                else if(i < names.length - 1){
                    figma.ui.postMessage({type:"folder-text", id:style.name.substring(0,indices[i]), name:names[i], parent:style.name.substring(0,indices[i-1])});
                }
                //last name corresponds to actual text style
                else{
                    //just use style id as its id
                    figma.ui.postMessage({type:"text", id:style.id, name:names[i], parent:style.name.substring(0,indices[i-1])});
                }
            }
        }
        else {figma.ui.postMessage({type:"text", id:style.id, name:style.name, parent:"result-text"});}
    }
}

export function getColorStyles(){

    let names;
    let indices;

    const colorStyles = figma.getLocalPaintStyles();

    //first, update loading screen for ui.html
    figma.ui.postMessage({type:"load-color"});

    for (const style of colorStyles){

        names = style.name.split("/");

        //construct folders for style if style is nested in folders ie there is "/" in its name
        if(names.length > 1){

            //we want to set folder paths as its id eg "C" folder in "A/B/C/D" will have id as "A/B/C"
            //parent folder "B" will have id "A/B"
            indices = findIndices(style.name, "/");

            for(let i = 0; i < names.length; i++){

                //build root folder with first name
                if(i == 0){
                    figma.ui.postMessage({type:"folder-color", id:names[i], name:names[i], parent:"result-color"});
                }
                //build child folders with ref to parent folder
                else if(i < names.length - 1){
                    figma.ui.postMessage({type:"folder-color", id:style.name.substring(0,indices[i]), name:names[i], parent:style.name.substring(0,indices[i-1])});
                }
                //last name corresponds to actual text style
                else{
                    //just use style id as its id
                    figma.ui.postMessage({type:"color", id:style.id, name:names[i], parent:style.name.substring(0,indices[i-1])});
                }
            }
        }
        else {figma.ui.postMessage({type:"color", id:style.id, name:style.name, parent:"result-color"});}
        
    }
}

//we want to break up the searching & loading of components into batches since searching
//every page in a Figma file aka figma.root.findAllWithCriteria() can be time-consuming on large files
//and make 
export async function getCompsAsync(){

    let comps;
    // debugger;
    const pages = figma.root.children;

    if(pages.length > 0){
        //split search into each page
        for (const page of pages){

            comps = page.findAllWithCriteria({types: ['COMPONENT', 'COMPONENT_SET']});

            //only bother if there are actually comps in current page
            if(comps.length > 0){

                //update loading screen on which page we're loading comps from
                figma.ui.postMessage({type:"load-comp", name:page.name});
                await delay(500);

                //filter out comps which are variants of component sets
                comps = comps.filter(comp => !(comp.type == "COMPONENT" && comp.parent?.type == "COMPONENT_SET"));

                //first load data div for page folder 
                figma.ui.postMessage({type:"folder-comp", id:"comp/"+page.id, name:page.name, parent:"result-comp"});
                figma.ui.postMessage({type:"set-num-items", id:"comp/"+page.id, numItems:comps.length+" components"});

                //then pull out data on comps in this page
                for(const comp of comps){
                    figma.ui.postMessage({type:"comp", id:comp.id, name:comp.name, parent:"comp/"+page.id});
                }
                //pause this function after processing every page and give ui.html time to update to make plugin appear more responsive
                await delay(500);
            }
        }
    }
    //once it's done, tell ui.html to hide loading screen
    figma.ui.postMessage({type:"load-end"});
}

export async function searchAsync(dataType: string, selection: string[]){

    let style;
    let layers;
    let comp;
    let instances;
    let page;
    let sum=0;

    //determine what to check based on data type
    switch(dataType){

        case "text": case "color":
            // debugger;
            for (const styleID of selection){

                style = figma.getStyleById(styleID);

                if(style != null){

                    layers = style.consumers;
                    //tell ui.html to update num of items for this text style
                    figma.ui.postMessage({type:"set-num-items", id:styleID, numItems:layers.length.toString()+" layers"});
                    figma.ui.postMessage({type:"load-search", loadText:"Finding layers using "+style.name+"..."});
                    await delay(100);

                    if(layers.length > 0){
                        //for each layer, find page it belongs to, and slot it under selected text style
                        for(const layer of layers){

                            page = findPage(layer.node as BaseNode);

                            if(page){
                                figma.ui.postMessage({type:"result-page", id:styleID+"/"+page.id, page:page.id, name:page.name, parent:styleID, numItems:"0 layers"});
                                figma.ui.postMessage({type:"result-data", id:styleID+"/"+layer.node.id, page:page.id, name:layer.node.name, parent:styleID+"/"+page.id});
                            }
                        }
                    }
                }
            //pause this function after processing every style to give ui.html time to update to make plugin appear more responsive
            await delay(500);
            }
        break;
        case "comp":
            for (const compID of selection){

                comp = figma.getNodeById(compID);

                if(comp != null){

                    switch(comp.type){

                        //if node has no variants, just read its instance property directly
                        case "COMPONENT":
                            instances = comp.instances;
                            //tell ui.html to update num of items for this component
                            figma.ui.postMessage({type:"set-num-items", id:compID, numItems:instances.length.toString()+" instances"});
                            figma.ui.postMessage({type:"load-search", loadText:"Finding instances of "+comp.name+"..."});
                            await delay(100);

                            if(instances.length > 0){
                                //for each instance, find page it belongs to, and slot it under selected component
                                for(const instance of instances){

                                    page = findPage(instance as BaseNode);

                                    if(page){
                                        figma.ui.postMessage({type:"result-page", id:compID+"/"+page.id, page:page.id, name:page.name, parent:compID, numItems:"0 instances"});
                                        figma.ui.postMessage({type:"result-data", id:compID+"/"+instance.id, page:page.id, name:instance.name, parent:compID+"/"+page.id});
                                    }
                                }
                            }
                        break;
                        //if node has variants, read instance of each of its variants aka its children
                        case "COMPONENT_SET":

                            figma.ui.postMessage({type:"load-search", loadText:"Finding instances of "+comp.name+"..."});
                            await delay(100);

                            for (const child of comp.children){

                                instances = (child as ComponentNode).instances;
                                
                                if(instances.length > 0){
                                    sum += instances.length;
                                    //for each instance, find page it belongs to, and slot it under selected component
                                    for(const instance of instances){
    
                                        page = findPage(instance as BaseNode);
    
                                        if(page){
                                            figma.ui.postMessage({type:"result-page", id:compID+"/"+page.id, page:page.id,name:page.name, parent:compID, numItems:"0 instances"});
                                            figma.ui.postMessage({type:"result-data", id:compID+"/"+instance.id, page:page.id, name:instance.name, parent:compID+"/"+page.id});
                                        }
                                    }
                                }
                            }
                            //tell ui.html to update num of items for this component
                            figma.ui.postMessage({type:"set-num-items", id:compID, numItems:sum.toString()+" instances"});
                        break;
                    }
                }
            //pause this function after processing every style to give ui.html time to update to make plugin appear more responsive
            await delay(500);
            }
        break;
    }
    //once it's done, tell ui.html to hide loading screen
    figma.ui.postMessage({type:"load-end"});
}

//searches recursively for page that node belongs to
function findPage(node:BaseNode){
    if(node.parent != null){

        if(node.parent.type == 'PAGE'){
            return node.parent;
        }
        else{return findPage(node.parent);}
    }
    else{
        return null;
    }
}

export function zoomIn(pageID:string, selectionIDs:string[]){

    let selectedNodes = [];

    //find every corresponding node in selection and tell Figma to zoom unto selection
    for(const id of selectionIDs){
        selectedNodes.push(figma.getNodeById(id) as SceneNode);
    }
    //first, move to the targeted page
    figma.currentPage = figma.getNodeById(pageID) as PageNode;
    //then set selection on that page to be our selected nodes
    figma.currentPage.selection = selectedNodes;
    //then tell figma to zoom into view
    figma.viewport.scrollAndZoomIntoView(selectedNodes);
}
