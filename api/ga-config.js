export default async function handler(req,res){try{
 const id=process.env.GA_MEASUREMENT_ID||""; if(!id) return res.status(200).json({enabled:false,reason:'Missing GA_MEASUREMENT_ID'});
 return res.status(200).json({enabled:true,id}); }catch(e){ return res.status(500).json({enabled:false,error:'server error'})}}