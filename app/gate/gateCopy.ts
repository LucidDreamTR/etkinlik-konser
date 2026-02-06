export const GATE_COPY = {
  heading: "Gate Doğrulama",
  subheading: "Satın alma API'sinden gelen claim code ile doğrulayın.",
  form: {
    operatorKeyLabel: "Operatör Anahtarı",
    eventIdLabel: "Etkinlik ID",
    tokenIdLabel: "Token ID",
    codeLabel: "Claim Kodu",
    rememberLabel: "Bu cihazda hatırla",
    verifyButton: "Doğrula",
    verifyingButton: "Doğrulanıyor...",
    clearButton: "Temizle",
    loadedFromUrl: "URL'den yüklendi.",
  },
  sections: {
    statusLabel: "Durum",
    lastRequestLabel: "Son İstek",
    lastRequestEmpty: "Henüz istek yok.",
    timestampLabel: "Zaman",
    lastUsedLabel: "Son kullanım",
    lastTxLabel: "Son işlem",
    responseLabel: "Yanıt",
    historyLabel: "Son Doğrulamalar",
    historyEmpty: "Henüz doğrulama yok.",
    responseEmpty: "Henüz yanıt yok.",
  },
  summary: {
    total: "TOPLAM",
  },
  history: {
    tokenLabel: "Token",
    codeLabel: "Kod",
    statusLabel: "Durum",
  },
  actions: {
    retry: "Tekrar dene",
    help: "Yardım",
    copyJson: "JSON Kopyala",
    copied: "Kopyalandı",
    copyFailed: "Kopyalama başarısız",
  },
  errors: {
    missingOperatorKey: "Operatör anahtarı zorunlu.",
    missingFields: "Etkinlik ID ve Token ID zorunlu.",
    missingCode: "Claim kodu zorunlu.",
    network: "Ağ hatası, tekrar deneyin.",
  },
  statuses: {
    VALID: {
      title: "Geçerli",
      description: "Giriş onaylandı.",
      badgeLabel: "GEÇERLİ",
    },
    INVALID_CODE: {
      title: "Geçersiz kod",
      description: "Kod okunamadı veya bu etkinliğe ait değil. QR/kodu tekrar okutun.",
      badgeLabel: "GEÇERSİZ KOD",
    },
    EVENT_MISMATCH: {
      title: "Yanlış etkinlik",
      description: "Bu bilet bu etkinlik için geçerli değil.",
      badgeLabel: "ETKİNLİK UYUMSUZ",
    },
    NOT_CLAIMED: {
      title: "Bilet henüz teslim alınmamış",
      description: "Bu bilet, sahibinin cüzdanına henüz claim edilmemiş. Lütfen sahibinden biletini claim etmesini isteyin.",
      badgeLabel: "CLAIM EDİLMEMİŞ",
    },
    ALREADY_USED: {
      title: "Bilet daha önce kullanılmış",
      description: "Bu bilet ile daha önce giriş yapılmış.",
      badgeLabel: "KULLANILMIŞ",
    },
    MISSING_CODE: {
      title: "Claim kodu eksik",
      description: "Doğrulama için claim kodu girin.",
      badgeLabel: "KOD EKSİK",
    },
    TEMPORARILY_LOCKED: {
      title: "Doğrulama sürüyor",
      description: "Bu bilet için başka bir doğrulama devam ediyor. Lütfen birkaç saniye sonra tekrar deneyin.",
      badgeLabel: "KİLİTLİ",
    },
    MISSING_OPERATOR_KEY: {
      title: "Operatör anahtarı gerekli",
      description: "Devam etmek için operatör anahtarını girin.",
      badgeLabel: "ANAHTAR GEREKLİ",
    },
    INVALID_OPERATOR_KEY: {
      title: "Hatalı operatör anahtarı",
      description: "Operatör anahtarı geçersiz veya iptal edilmiş. Doğru anahtarı girin.",
      badgeLabel: "ANAHTAR HATASI",
    },
    MISSING_FIELDS: {
      title: "Eksik bilgi",
      description: "Etkinlik ID ve Token ID gerekli.",
      badgeLabel: "EKSİK BİLGİ",
    },
    UNAUTHORIZED: {
      title: "Yetkisiz",
      description: "Operatör anahtarı geçersiz.",
      badgeLabel: "YETKİSİZ",
    },
    NETWORK_ERROR: {
      title: "Bağlantı sorunu",
      description: "Ağ bağlantısı yok veya zincire ulaşılamıyor. İnterneti kontrol edip tekrar deneyin.",
      badgeLabel: "BAĞLANTI SORUNU",
    },
    ERROR: {
      title: "Hata",
      description: "Bir hata oluştu.",
      badgeLabel: "HATA",
    },
    LOADING: {
      title: "Doğrulanıyor...",
      description: "Bilet kontrol ediliyor.",
      badgeLabel: "DOĞRULANIYOR",
    },
    UNKNOWN: {
      title: "Hazır",
      description: "Doğrulama bekleniyor.",
      badgeLabel: "HAZIR",
    },
    RATE_LIMITED: {
      title: "Çok hızlı deneme",
      description: "Kısa süre içinde fazla doğrulama yapıldı. Lütfen biraz sonra tekrar deneyin.",
      descriptionWithRetry:
        "Kısa süre içinde fazla doğrulama yapıldı. {retryAfterSec} sn sonra tekrar deneyin.",
      badgeLabel: "HIZ SINIRI",
    },
  },
} as const;

export type GateCopy = typeof GATE_COPY;

type GateStatusCopyKey = keyof GateCopy["statuses"];

export function getGateStatusDescription(
  key: GateStatusCopyKey,
  options?: { retryAfterSec?: number }
): string {
  const status = GATE_COPY.statuses[key];
  if ("descriptionWithRetry" in status && options?.retryAfterSec) {
    return status.descriptionWithRetry.replace("{retryAfterSec}", String(options.retryAfterSec));
  }
  return status.description;
}
