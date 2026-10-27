import {modelSelectionPrice} from './programaticModelSelection.js'


const models = await modelSelectionPrice(2000,400,100,10000);
console.log(models) ;