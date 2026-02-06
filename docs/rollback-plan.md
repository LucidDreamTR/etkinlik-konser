# Rollback Plan — EventTicket vNext (Env-Only)

## AMAÇ
- Yeni deploy edilen vNext EventTicket kontratından,
  tek satırlık env değişikliğiyle eski kontrata güvenli geri dönüşü garanti altına almak.

## KAPSAM
- SADECE env tabanlı rollback
- Kod / ABI / migration DEĞİŞMEZ
- Veri kaybı YOK (kontrat bazlı token ownership)

## YAPILACAKLAR (SIRAYLA)

### 1) ENV STRATEJİSİ
- Aktif kontrat adresi:
  NEXT_PUBLIC_TICKET_CONTRACT_ADDRESS_SEPOLIA
- Pasif / bekleyen kontrat adresi:
  NEXT_PUBLIC_TICKET_CONTRACT_ADDRESS_SEPOLIA_VNEXT

### 2) AKTİF ADRES MANTIĞI
- Uygulama runtime boyunca SADECE
  NEXT_PUBLIC_TICKET_CONTRACT_ADDRESS_SEPOLIA kullanır.
- *_VNEXT değişkeni KODDA ASLA referans edilmez.

### 3) ROLLBACK SENARYOSU
- Rollback gerektiğinde:
  - *_SEPOLIA değeri eski kontrata alınır
  - Dev / prod restart edilir
- Uygulama davranışı değişmez:
  - Gate verify
  - Purchase
  - Claim
  - Operator key kontrolü
  hepsi çalışmaya devam eder.

### 4) GÜVENLİK GARANTİLERİ
- Eski kontrat:
  - Read-only olarak kalır
  - Mint edilmez
- Yeni kontrat:
  - Aktif edilmeden önce test edilir
- Kullanıcı verisi, order, audit, claim state etkilenmez.

### 5) BAŞARI KRİTERİ
- Rollback sonrası:
  - /gate açılıyor
  - /api/gate/verify 200 dönüyor
  - Reason enum’ları geçerli (valid / already_used / event_mismatch)
  - 500 / ABI / revert hatası YOK

## ÇIKTI
- Rollback süresi < 1 dakika
- Kod değişmeden geri dönüş mümkün
- FAZ 3 için prod güvenliği sağlanmış olur
