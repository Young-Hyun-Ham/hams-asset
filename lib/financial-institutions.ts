export type FinancialInstitution = {
  code: string;
  name: string;
};

export const BANKS: FinancialInstitution[] = [
  { code: "kb", name: "KB국민은행" },
  { code: "shinhan", name: "신한은행" },
  { code: "woori", name: "우리은행" },
  { code: "hana", name: "하나은행" },
  { code: "nh", name: "NH농협은행" },
  { code: "ibk", name: "IBK기업은행" },
  { code: "sc", name: "SC제일은행" },
  { code: "kakao-bank", name: "카카오뱅크" },
  { code: "k-bank", name: "케이뱅크" },
  { code: "toss-bank", name: "토스뱅크" },
  { code: "im-bank", name: "iM뱅크" },
  { code: "busan", name: "부산은행" },
  { code: "kyongnam", name: "경남은행" },
  { code: "gwangju", name: "광주은행" },
  { code: "jeonbuk", name: "전북은행" },
  { code: "jeju", name: "제주은행" },
  { code: "suhyup", name: "Sh수협은행" },
  { code: "korea-post", name: "우체국예금" },
  { code: "mg", name: "새마을금고" },
  { code: "cu", name: "신협" },
  { code: "savings-bank", name: "저축은행" },
];

export const BROKERAGES: FinancialInstitution[] = [
  { code: "shinhan-securities", name: "신한투자증권" },
  { code: "korea-investment", name: "한국투자증권" },
  { code: "mirae-asset", name: "미래에셋증권" },
  { code: "samsung-securities", name: "삼성증권" },
  { code: "kb-securities", name: "KB증권" },
  { code: "nh-investment", name: "NH투자증권" },
  { code: "kiwoom", name: "키움증권" },
  { code: "hana-securities", name: "하나증권" },
  { code: "daishin", name: "대신증권" },
  { code: "meritz", name: "메리츠증권" },
  { code: "toss-securities", name: "토스증권" },
  { code: "kakaopay-securities", name: "카카오페이증권" },
  { code: "yuanta", name: "유안타증권" },
  { code: "db-financial", name: "DB증권" },
  { code: "ls-securities", name: "LS증권" },
  { code: "sk-securities", name: "SK증권" },
  { code: "ibk-securities", name: "IBK투자증권" },
  { code: "hanwha-investment", name: "한화투자증권" },
  { code: "hyundai-motor", name: "현대차증권" },
  { code: "eugene-investment", name: "유진투자증권" },
  { code: "cape-investment", name: "케이프투자증권" },
  { code: "bookook", name: "부국증권" },
];
