export function resourceAvailability({cpuLoad,gpuLoad},freeMemory,totalMemory){
 const minFree=Math.max(2*1024**3,totalMemory*.15);
 return {ready:cpuLoad<=40&&(gpuLoad==null||gpuLoad<=50)&&freeMemory>=minFree,cpuLoad,gpuLoad,freeMemory,minFree};
}
