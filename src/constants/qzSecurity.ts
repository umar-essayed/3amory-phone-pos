// ═══════════════════════════════════════════════════════════════════════════
// 3amory phone POS - Official QZ Tray Security & Digital Signature Engine
// Provides self-signed X.509 Certificate and RSA-SHA512 request signing
// to eliminate all "Untrusted website" and "Anonymous request" dialogs.
// ═══════════════════════════════════════════════════════════════════════════

import qz from 'qz-tray';

export const QZ_CERTIFICATE = `-----BEGIN CERTIFICATE-----
MIID0TCCArmgAwIBAgIUbEtmz4NQFeGF3z+6yGpZLPPjI6swDQYJKoZIhvcNAQEL
BQAweDELMAkGA1UEBhMCRUcxDjAMBgNVBAgMBUNhaXJvMQ4wDAYDVQQHDAVDYWly
bzEVMBMGA1UECgwMM2Ftb3J5IHBob25lMRcwFQYDVQQLDA5QT1MgRGVwYXJ0bWVu
dDEZMBcGA1UEAwwQM2Ftb3J5IHBob25lIFBPUzAeFw0yNjA5MTQxMjQwMDlaFw0z
NjA5MTExMjQwMDlaMHgxCzAJBgNVBAYTAkVHMQ4wDAYDVQQIDAVDYWlybzEOMAwG
A1UEBwwFQ2Fpcm8xFTATBgNVBAoMDDNhbW9yeSBwaG9uZTEXMBUGA1UECwwOUE9T
IERlcGFydG1lbnQxGTAXBgNVBAMMEDNhbW9yeSBwaG9uZSBQT1MwggEiMA0GCSqG
SIb3DQEBAQUAA4IBDwAwggEKAoIBAQC2Zs98regmhQJTeC5/v2zCYiik9waBR+xi
X/mhwzFlOpsFNHjjTHEe0u8k669pGmIV0Hhu8foSovUSzB7kA9BhmR3NiQ0lFAFe
lJlFhWaHqjk3YOrQMZA4odg+A/k+vYRTHl2Q1xgLTxZRX18n7x9b+1/g+FswG8kZ
2i9uuIV9htv9efCjaUgvB1q/wd59TBkaKXfoydgCbRmGDg2XluEh/wYmNOY7YW1W
pm3irD8L4g3nCjmBqyGC5pqXu2zFD1AAcuBx+27SbdZm7ecDEQ6P7EX1ANSleI3/
4Kgec0iN6M6dvzKPGffN0evdkOT99w84avKSWUZDyenoidhc4DvbAgMBAAGjUzBR
MB0GA1UdDgQWBBTzlg7TcJ+bKkJTR1g/1OJihCNAiDAfBgNVHSMEGDAWgBTzlg7T
cJ+bKkJTR1g/1OJihCNAiDAPBgNVHRMBAf8EBTADAQH/MA0GCSqGSIb3DQEBCwUA
A4IBAQBbKuNrL/pzTdwiqFx8xYiocPnTDEz0oG2rQk2OgGKMDVxUil3omeYU236E
KIfvc9tTLQ/D/HxnDsfT0P1RfVLFdVQFhj3Lhw4zo42qz7+rpYio94Ejf0yu/1/j
tKPuDKbZiyw/gEsqdCtdEQ4XyQHcXlEp2A9IlpEATKLa4Wl7uuzbeN/aNWlTzOAo
9IhHGZADOOQAJfzJjNLHL5+Zs/aijOwbfU3sCL7vIY3a9fEKX/pvNSDYuiU9Uyxb
7KnPmS7Dre+5z2DpgZAO4bZ9VAy4vgSX46WGjRjGtJaKPaxhzUPMT94uHubThv7Y
UbRDSK0IWhxU+0XADnNPSFMpaAQG
-----END CERTIFICATE-----`;

export const QZ_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC2Zs98regmhQJT
eC5/v2zCYiik9waBR+xiX/mhwzFlOpsFNHjjTHEe0u8k669pGmIV0Hhu8foSovUS
zB7kA9BhmR3NiQ0lFAFelJlFhWaHqjk3YOrQMZA4odg+A/k+vYRTHl2Q1xgLTxZR
X18n7x9b+1/g+FswG8kZ2i9uuIV9htv9efCjaUgvB1q/wd59TBkaKXfoydgCbRmG
Dg2XluEh/wYmNOY7YW1Wpm3irD8L4g3nCjmBqyGC5pqXu2zFD1AAcuBx+27SbdZm
7ecDEQ6P7EX1ANSleI3/4Kgec0iN6M6dvzKPGffN0evdkOT99w84avKSWUZDyeno
idhc4DvbAgMBAAECggEAQ7y2fSTQO83VaU4OZp6eMynk0i5ymfwtyvK9b9dfNqqm
+y3bXv36XGoVKW7lO3Dy0AsVTo5KQjWGMa7gIelQr43/RV8KJKTjRU6GBQ1fYC5V
BT3Wte5SEtX3ykALhcM3qu5x7OIUKc77CMkUO25QBQa7On7AzoLjEdi3GLUpzc1v
dx/e/cnm6mBZc1jo5wvMxh3RXv55xGRAknRnQ+sdJDt2duro0E5OlKjHZ5hjNBtK
NGmIPt8apUFHij+siHHoR3wwEf8eiW/Sz32I2J6mTg03qc4qImdx2IZ6FxSVDuRN
TZJdqcQpjawb7AsTi6Kor+hqiv7SwK+nWzq0mTf9cQKBgQD2CS+s1tU90KOs/hDU
9as6SpqrwJepsqQ62pqc/wjP1qZWps3q9/fBi3knKbSJAve8QIez5IOj106YO0nL
QCxQ91K9RairU1+iZ8c6GmzlR3r3Io8b3BypCUxokubYpWYGKi3SPBRCTeIxtbG1
HHtmGJ5YSDM6ng2XZ7l25+vKHwKBgQC9yeLolgUQsqvr/Mfm4dlV8czHLwjgjK/N
9XhYKyMgAZAnJwg7wAurDBU68BY/nKyn8pUnYne7OJBdScrR4c2CgKybRZOH+gNo
k1UfKM9BqFWlrF5z15WeEZD1wHMgyxuYHA6jlBIbYkx73QhRneOJy0ggqNfVFRn/
9yr31KAOxQKBgQDDPQruFxTklrorvvlQZRrZiPYwMQapDS+x3GMxDljJxUX+ISPq
v5eFqM4dO8UdrJM2eea15DJqQ6MEvpeSiHwiTAEGXU65ldGgKMY531pmn1B+6Jez
vfmoUc6mdVxmsunBHpt5518UNoW2eL5qQA3UONj+qVytuVqDuTW9m9DKdQKBgA1t
pGVqf+8/hRSMbSRz5GnFUwTg2hLxQVskPCCY5MJV+fobM+TuYKT4lOP3qstTbY/w
hQclW21ewjAnkXcqL91E93GBCcA8O1OB4Sr0Oz3dCDpRqNkvbsGhYo1Q0ZSHamtn
yM1gI6vWV60H5ZfIwRm1zWOqLqM/+/f1aA/i9nQ1AoGAEZ25+Peue0mfLSVvhPIJ
/PHOv0j6x0K3pfJcj1wRjcutpkQt5ckwa9Aeo9sFDM/GaTO+rgEzfNJOpt8+DwWu
W2w2NLFK4vqLm4Gcks9mlDzgVNHCDUcbJiQ2jYpM/e3ijjltMjAN1RtiVvTHteQi
U+sJElDHRZFiiENROqwKYSI=
-----END PRIVATE KEY-----`;

let cachedCryptoKey: CryptoKey | null = null;

async function getSubtleCryptoKey(): Promise<CryptoKey> {
  if (cachedCryptoKey) return cachedCryptoKey;

  const b64 = QZ_PRIVATE_KEY.replace(/-----[^\n]+-----/g, '').replace(/\s+/g, '');
  const rawBytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;

  cachedCryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    rawBytes,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-512',
    },
    false,
    ['sign']
  );

  return cachedCryptoKey;
}

/**
 * Digitally signs the payload using RSA-SHA512.
 * Uses Electron native crypto if available, otherwise falls back to WebCrypto Subtle API.
 */
export async function signQzPayload(toSign: string): Promise<string> {
  // 1. Electron IPC Native Signing
  if (typeof window !== 'undefined' && (window as any).electronAPI?.qzSign) {
    try {
      const res = await (window as any).electronAPI.qzSign(toSign);
      if (res) return res;
    } catch (err) {
      console.warn('Electron IPC signing note:', err);
    }
  }

  // 2. WebCrypto Subtle Signing (Browsers & Progressive Web Apps)
  try {
    const key = await getSubtleCryptoKey();
    const encoder = new TextEncoder();
    const data = encoder.encode(toSign);
    const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, data);
    
    // Base64 encode
    let binary = '';
    const bytes = new Uint8Array(signature);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  } catch (err) {
    console.error('Failed to digitally sign QZ Tray request:', err);
    throw err;
  }
}

let securityInitialized = false;

/**
 * Initializes QZ Tray security promises so all subsequent printer calls are signed and trusted.
 */
export function initQzSecurity() {
  if (securityInitialized) return;
  securityInitialized = true;

  try {
    qz.security.setCertificatePromise((resolve) => {
      resolve(QZ_CERTIFICATE);
    });

    qz.security.setSignatureAlgorithm('SHA512');

    qz.security.setSignaturePromise((toSign: string) => {
      return (resolve: (sig: string) => void, reject: (err: any) => void) => {
        signQzPayload(toSign)
          .then(resolve)
          .catch(reject);
      };
    });
  } catch (err) {
    console.warn('QZ security initialization note:', err);
  }
}
