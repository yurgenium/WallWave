using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
[StructLayout(LayoutKind.Sequential)] public struct WRect { public int left,top,right,bottom; }
[ComImport,Guid("B92B56A9-8B55-4E14-9A89-0199BBB6F93B"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IWallpaper {
 void SetWallpaper([MarshalAs(UnmanagedType.LPWStr)] string monitor,[MarshalAs(UnmanagedType.LPWStr)] string file);
 void GetWallpaper([MarshalAs(UnmanagedType.LPWStr)] string monitor,[MarshalAs(UnmanagedType.LPWStr)] out string file);
 void GetMonitorDevicePathAt(uint index,[MarshalAs(UnmanagedType.LPWStr)] out string id);
 void GetMonitorDevicePathCount(out uint count);
 void GetMonitorRECT([MarshalAs(UnmanagedType.LPWStr)] string id,out WRect rect);
}
public class WMonitor {public string id;public string wallpaper;public int width,height,left,top;}
public static class WallpaperNative {
 static IWallpaper Open(){return (IWallpaper)Activator.CreateInstance(Type.GetTypeFromCLSID(new Guid("C2CF3110-460E-4FC1-B9D0-8A1C0C9CC4BD")));}
 public static WMonitor[] List(){var api=Open();try{uint count;api.GetMonitorDevicePathCount(out count);var result=new List<WMonitor>();for(uint i=0;i<count;i++){string id,file;WRect r;api.GetMonitorDevicePathAt(i,out id);try{api.GetMonitorRECT(id,out r);}catch(COMException){continue;}if(r.right<=r.left||r.bottom<=r.top)continue;api.GetWallpaper(id,out file);result.Add(new WMonitor{id=id,wallpaper=file,width=r.right-r.left,height=r.bottom-r.top,left=r.left,top=r.top});}return result.ToArray();}finally{Marshal.ReleaseComObject(api);}}
 public static void Set(string monitor,string file){var api=Open();try{api.SetWallpaper(monitor,file);}finally{Marshal.ReleaseComObject(api);}}
}
