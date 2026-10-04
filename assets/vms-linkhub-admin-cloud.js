/* VMS LinkHub Admin Cloud — compatibility stub.
   The real cloud sync runs through vms-state.js and Supabase.
   This file exists so the validator and any legacy references resolve cleanly. */
if(!window.VMSLinkHubCloud){
  window.VMSLinkHubCloud={
    sync:async()=>{},
    push:async()=>{},
    pull:async()=>{}
  };
}
