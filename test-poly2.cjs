const polyline = require('@mapbox/polyline');
const str = "gwr{FqhgLDJHK\\e@DGDGNSU]CCk@}@CGIICGEMAG?IAI?K?G?G?_@?{I?E?k@SYCEOSKOg@s@{@qAEGk@w@CGOUCEO_@aAuDs@aCk@sBEKQ_@MQ[c@ACCEAAKKI?GBEFCDABAF?F?B?H?HAL?FAJHh@@D\\nAJ`@Pn@V|@@FHVr@hCRp@@Db@~ABFLd@FTb@`Bd@dBBHHZVz@XhAJ`@Rr@Nj@?BBFRt@L\\J^f@jBFRBJ??@DNl@DJHK\\e@DGDGNSU]CCk@}@CGIICGEMAG?IAI?K?G?G?_@?{I?E?k@SYCEOSKOg@s@{@qAEGk@w@CGOUCEO_@aAuDs@aCk@sBEKQ_@MQ[c@ACCEAAKKQWQWMQCCmAeBAA[]UYKOiBkCKO@GFIDIHMR]P_@Pc@JYFMDMHQJQJM^g@zAuBDG`@i@Ya@EGgBkCCCYk@g@m@cBcCEGKQGKt@?F?rD@D?@?^?\\HZPBBpAlBn@|@PVFJd@r@z@nAh@r@BFRVKNEDqBtC_@f@a@j@yAxBEF]h@a@j@cB`CCDW\\UYKOiBkCKO@GFIDIHMR]P_@Pc@JYFMDMHQJQJM^g@zAuBDG`@i@Xc@BEpByCLS@?@EHKOWc@o@GICEW_@c@o@OSEEOUIKAAACCAACMOMSA?OWEGu@eAS[CG[e@BENSJMFKl@}@j@{@@ABE\\e@Xe@FIjBmCLQBE\\g@FKPUFKX_@jA_BBG^g@\\g@BC~A_CBE`@m@^i@|@uABEV_@JM@CV_@p@}@DGLSDEDGNSNUR]@ABE\\i@RZHHb@r@RZPVb@n@@@`@l@dA|AdAbBv@zAr@`Bt@hBnC|G~CzIr@nB\\`ALZJXDLhA~C@DRf@CVCJAHCD?DELQd@Yx@M\\EJABIVSh@MK[UgA}@h@mAi@lA_@Wk@|AKXu@m@USTRUSYUXTM\\A@CHCDq@vAe@v@MVKTi@`AABF@LHHDTQLML[Xq@^{@TLQx@IDUn@a@fAADaAg@K@JATDFD`@RB@B@TLCDBEDQEPf@VCFBGDKEJVLBBB@??TLDOX{@VLHFDMb@X?FKZJ[?Gc@YLi@FSGEk@a@OXNY@CEAc@Ub@TADg@WFWPHVLEJADD@AB@C@CL_@ECMGYOXNLFDBL]o@[n@ZPk@Qj@M\\M^ABABj@`@DGh@}ABGCFi@|AEFFDB@CAGRMh@ELIGIROj@EJDKNk@HSWMYO[SMh@KVJWLi@e@S[v@Zw@YM]Oe@[i@`AABAF?DECDB?FALADCDkCjBBDdAdAa@r@EJW`@a@l@ABCD]b@FRJ^GJUf@Of@Qj@]Ka@K[Oc@MSGRFSGMEh@sAi@rALDMEQGUG[EQ@c@E[Co@GGAF@GASC_@Em@ICLARA^YdA^^_@_@XeA@_@@SBMuASE?eAOe@CMAE?GAT_ADQNA~@A@N@H@Bv@L^D|@J}@K_@Ew@MACAIAOTAVAD?DEVUHKFGFKLEz@uAFKBGFINUBEP[DCDGPWd@s@PWNSJKBCNUfA_BLOLS\\e@v@kA`AyAn@}@\\g@BEDEBEVYFDFFB@DB@BdAx@HFPNfAz@DBDDNLZTXTM\\A@CHCDq@vAe@v@MVKTi@`AABAF?D?FALDFJLSh@Qd@_@z@S`@a@r@EJW`@a@l@ABCD]b@FRJ^GJUf@Of@Qj@d@Jp@Vq@WO|@G^Sh@d@\\CD{@hB_@r@CDABCFMMa@[Yu@CBBCISCICBELINQNMF[w@O_@EDAA]XWVg@n@Vb@f@r@d@l@DDlAnA\\b@RVFHHHw@lAmBzCq@o@m@q@g@m@GIBEfBoC?En@t@v@z@h@f@D@d@bANVeAtAc@n@[a@c@e@lB{CD@d@bANVOWNVV]^_\@H\\XYYXTx@Xl@@BDH@B@DMPEHY^X_@Y^X_@Y^]f@MRQVm@x@MTEDEFDGEFDGEF]f@SVQXEFqDhFpDiFqDhFOPU]CCk@}@CGIICGEMAG?IAI?K?G?G?GJEAIDA?J?L?M?KFCl@WXKBAFCDAFC??VKXKLGPGLE??FCHCCCiA_BCE{BcDAECCWYSYCEOSKOg@s@{@qAEGk@w@CGOUCEO_@aAuDDEbAo@FC?AXOVOa@yB\\@DcA@GAF@GbBt@LFB@NLn@b@FIXg@@EBGFOL[PUHGNS??DIBETi@Lg@n@FAO@NAOCs@W}BCOb@KDANEVGKSy@mAKOJNx@lAJRJC|Bk@DANEPGFEHGFG|@s@n@m@PTHLHXHEDHBDCEEIDHkAt@k@`@A?EBEIAC?CCCGICAA?CCMMSW_C_DIKHJ~B~CRVLLBB@DDF@@BDD@DHBBFJ\\d@BDDF@@@@j@x@@@CD]b@FRJ^GJUf@Of@Qj@d@JO|@G^Sh@d@\\CD{@hBY[r@qBd@\\e@]c@_@QOWSEABKF[L}@|";
const decoded = polyline.decode(str, 5);

function distance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI/180; // φ, λ in radians
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; 
}

let distMeters = 0;
for(let i=0; i<decoded.length-1; i++) {
   distMeters += distance(decoded[i][0], decoded[i][1], decoded[i+1][0], decoded[i+1][1]);
}
console.log('Distance: ' + (distMeters/1000).toFixed(2) + ' km');
