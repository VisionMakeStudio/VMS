/* VMS branded Member Portal magic-link sender. Secrets stay in Netlify. */

const json=(body:any,status=200)=>new Response(JSON.stringify(body),{
  status,
  headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}
});

const clean=(value:any,max=1000)=>String(value??'').trim().slice(0,max);
const escapeHtml=(value:any)=>clean(value,4000).replace(/[&<>"']/g,(ch)=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[ch]||ch));

function env(name:string){
  const netlifyEnv=(globalThis as any)?.Netlify?.env;
  return clean(netlifyEnv?.get?.(name),5000);
}

async function getClient(supabaseUrl:string,secret:string,email:string){
  const url=new URL('/rest/v1/clients',supabaseUrl);
  url.searchParams.set('select','id,business_name,contact_name,owner_email,status');
  url.searchParams.set('owner_email',`eq.${email}`);
  url.searchParams.set('limit','1');
  const response=await fetch(url,{headers:{apikey:secret,Authorization:`Bearer ${secret}`}});
  if(!response.ok)throw new Error(`Client lookup failed (${response.status}).`);
  const rows=await response.json();
  return Array.isArray(rows)?rows[0]||null:null;
}

async function generateMagicLink(supabaseUrl:string,secret:string,email:string,redirectTo:string){
  const response=await fetch(new URL('/auth/v1/admin/generate_link',supabaseUrl),{
    method:'POST',
    headers:{'content-type':'application/json',apikey:secret,Authorization:`Bearer ${secret}`},
    body:JSON.stringify({type:'magiclink',email,redirect_to:redirectTo})
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(clean(data?.msg||data?.message||`Magic-link generation failed (${response.status}).`,500));
  const actionLink=clean(data?.action_link||data?.properties?.action_link,8000);
  if(!actionLink)throw new Error('Magic-link generation returned no secure link.');
  return actionLink;
}

function brandedEmail({actionLink,businessName,contactName,origin}:{actionLink:string,businessName:string,contactName:string,origin:string}){
  const name=escapeHtml(contactName||businessName||'there');
  const business=escapeHtml(businessName||'your business');
  const logo=`${origin.replace(/\/$/,'')}/assets/vms-logo.png`;
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f4f7f8;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#173443">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7f8;padding:28px 12px"><tr><td align="center">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #dfe7ea;border-radius:18px;overflow:hidden;box-shadow:0 18px 50px rgba(0,48,73,.08)">
      <tr><td style="background:#003049;padding:24px 28px;text-align:center"><img src="${escapeHtml(logo)}" alt="Vision Make Studio" width="150" style="display:inline-block;max-width:150px;height:auto"></td></tr>
      <tr><td style="padding:34px 32px 28px">
        <div style="font-size:12px;letter-spacing:.13em;font-weight:800;color:#669BBC;text-transform:uppercase">Member Portal</div>
        <h1 style="margin:9px 0 12px;font-size:27px;line-height:1.15;color:#003049">Your secure sign-in link is ready</h1>
        <p style="margin:0 0 12px;font-size:16px;line-height:1.6;color:#536d78">Hi ${name},</p>
        <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#536d78">Use the button below to securely access the Vision Make Studio Member Portal for <strong style="color:#173443">${business}</strong>.</p>
        <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 24px"><tr><td style="border-radius:11px;background:#EB5E28"><a href="${escapeHtml(actionLink)}" style="display:inline-block;padding:14px 22px;color:#fff;text-decoration:none;font-size:16px;font-weight:800">Sign in to Member Portal</a></td></tr></table>
        <div style="padding:14px 16px;border-radius:12px;background:#FDF0D5;color:#665a43;font-size:13px;line-height:1.55">This is a secure one-time sign-in link and it expires automatically. If you did not request it, you can safely ignore this email.</div>
        <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#7a8e98">Need help? Reply to this email or contact <a href="mailto:info@visionmakestudio.com" style="color:#003049;font-weight:700">info@visionmakestudio.com</a>.</p>
      </td></tr>
      <tr><td style="padding:18px 28px;background:#08283d;text-align:center;color:#a9c1cc;font-size:12px;line-height:1.6">Vision Make Studio · Websites, visibility & smarter systems<br><span style="color:#7f9daa">Secure client access</span></td></tr>
    </table>
  </td></tr></table></body></html>`;
}

export default async (req:Request)=>{
  if(req.method!=='POST')return json({error:'Method not allowed.'},405);

  const supabaseUrl=env('SUPABASE_URL');
  const secret=env('SUPABASE_SECRET_KEY')||env('SUPABASE_SERVICE_ROLE_KEY');
  const resendKey=env('RESEND_API_KEY');
  const from=env('VMS_NOTIFICATION_FROM')||'Vision Make Studio <notifications@visionmakestudio.com>';
  if(!supabaseUrl||!secret||!resendKey)return json({error:'Member Portal email service is not fully configured.'},503);

  let body:any={};
  try{body=await req.json();}catch{return json({error:'Invalid request.'},400)}
  const email=clean(body?.email,320).toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return json({error:'Enter a valid email address.'},400);

  const requestOrigin=new URL(req.url).origin;
  const redirectPath=clean(body?.redirectPath||'/portal/',500);
  const safePath=redirectPath.startsWith('/portal')?redirectPath:'/portal/';
  const redirectTo=new URL(safePath,requestOrigin).href;

  try{
    const client=await getClient(supabaseUrl,secret,email);
    const blocked=client && /archived|deleted/i.test(clean(client.status,80));

    /* Avoid account enumeration: unknown/blocked addresses receive the same public response. */
    if(!client||blocked)return json({ok:true,message:'If this email is linked to a VMS client account, a secure sign-in link will arrive shortly.'});

    const actionLink=await generateMagicLink(supabaseUrl,secret,email,redirectTo);
    const html=brandedEmail({
      actionLink,
      businessName:clean(client.business_name,180),
      contactName:clean(client.contact_name,180),
      origin:requestOrigin
    });

    const sent=await fetch('https://api.resend.com/emails',{
      method:'POST',
      headers:{Authorization:`Bearer ${resendKey}`,'content-type':'application/json'},
      body:JSON.stringify({
        from,
        to:[email],
        subject:'Your Vision Make Studio sign-in link',
        html,
        text:`Your secure Vision Make Studio Member Portal sign-in link: ${actionLink}\n\nIf you did not request this link, you can ignore this email.\n\nVision Make Studio · info@visionmakestudio.com`,
        reply_to:'info@visionmakestudio.com'
      })
    });
    const sentData=await sent.json().catch(()=>({}));
    if(!sent.ok)throw new Error(clean(sentData?.message||`Email delivery failed (${sent.status}).`,500));

    return json({ok:true,message:'If this email is linked to a VMS client account, a secure sign-in link will arrive shortly.'});
  }catch(error:any){
    console.error('VMS member magic-link error',clean(error?.message||error,800));
    return json({error:'We could not send the secure VMS sign-in email right now. Please try again.'},502);
  }
};

export const config={path:'/api/member-magic-link'};
