export default async function handler(req,res){try{
 const pub=process.env.ADSENSE_PUBLISHER_ID||""; const home=process.env.ADSENSE_SLOT_HOME||"";
 const tap=process.env.ADSENSE_SLOT_TAPREFLEX||""; const tr=process.env.ADSENSE_SLOT_TARGETRUSH||""; const ss=process.env.ADSENSE_SLOT_SEQUENCESPRINT||"";
 if(!pub) return res.status(200).json({enabled:false,reason:'Missing ADSENSE_PUBLISHER_ID'});
 return res.status(200).json({enabled:true,publisher:pub,slots:{home,tapreflex:tap,targetrush:tr,sequencesprint:ss}});
}catch(e){return res.status(500).json({enabled:false,error:'server error'})}}