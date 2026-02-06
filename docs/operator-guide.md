# Gate Operator Kullanım Rehberi

## Giriş
- Amaç: Güvenli ve hızlı giriş doğrulaması sağlamak.
- Operator key doğrulamanın temelidir; geçerli değilse giriş onaylanmaz.

## Gate Ekranı Alanları
- **Operator Key** (zorunlu)
- **Event ID**
- **Token ID**
- **Claim Code** (opsiyonel; default UX’te gerekmez)

## Doğrulama Sonuçları
- **GEÇERLİ** → Giriş onaylandı
- **KULLANILMIŞ** → Daha önce giriş yapılmış
- **ETKİNLİK UYUMSUZ** → Yanlış etkinlik
- **ANAHTAR HATASI** → Geçersiz/iptal edilmiş operator key
- **ANAHTAR GEREKLİ** → Operator key boş
- **BAĞLANTI SORUNU** → Network/offline
- **KİLİTLİ (temporarily_locked)** → Aynı bilet için doğrulama sürüyor
- **RATE LIMITED (429)** → Çok sık deneme

## İyi Uygulamalar
- Aynı bileti art arda okutmayın; tek okuma yeterlidir.
- **KİLİTLİ** uyarısında kısa süre bekleyip tekrar deneyin.
- Offline durumda bağlantı geri geldiğinde tekrar doğrulayın.

## Güvenlik Notları
- Operator key paylaşılmaz.
- Şüpheli bir durum varsa yöneticiyi bilgilendirin.
- Audit log’lar sistem tarafından tutulur.
