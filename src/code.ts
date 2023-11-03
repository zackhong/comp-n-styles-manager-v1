import * as Helper from './helper';


figma.showUI(__html__);
figma.ui.resize(400,800);

figma.ui.onmessage = message => {

    switch(message.msgType){

        case "start":
            Helper.getTextStyles();
            Helper.getColorStyles();
            Helper.getCompsAsync();
            // figma.ui.postMessage({type:"load-end"});
        break;

        case "search":
            Helper.searchAsync(message.dataType, message.selection);
        break;

        case "zoom-in":
            Helper.zoomIn(message.selectedPage, message.selection);
        break;
    }
}