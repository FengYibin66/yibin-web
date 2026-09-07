import type { CredentialsContent } from './types'

/*
  图片都是 `scripts/media/optimize-credentials.mjs` 出的 webp 产物，原图在
  `media-src/credentials/`。加一张图：原图放进 media-src、在脚本 PLAN 里声明
  它是文件还是照片、跑一次脚本、这里引用 `.webp`。

  `fit: 'contain'` 标在**竖版**文件上：4:3 卡片用 `object-cover` 会把竖版证书
  裁掉近一半，底部的印章 / 签名正好在被切的那段。哪些该标由
  `__tests__/credentialsAssets.test.ts` 按原图尺寸对账。
*/

export const credentialsZh: CredentialsContent = {
  title: '荣誉与证书',
  awardsTitle: '荣誉奖项',
  certificatesTitle: '证书',
  viewAllLabel: '查看全部',
  backLabel: '返回简历',
  awards: [
    {
      id: 'zhang-guifang',
      title: '优秀毕业生 & 张桂芳奖学金',
      level: '校级，前 0.05%',
      note: '土木工程学院最优学生',
      image: '/credentials/awards/Outstanding_Graduate_Zhangguifang_Scholarship.webp',
    },
    {
      id: 'cidaren-province',
      title: '「词达人杯」全国英语词汇竞赛四川省特等奖',
      level: '省级，前 1%',
      image: '/credentials/awards/1st_pro_cidaren.webp',
    },
    {
      id: 'cidaren-national',
      title: '「词达人杯」全国英语词汇竞赛全国二等奖',
      level: '国家级，前 0.03%',
      image: '/credentials/awards/2rd_national_cidaren.webp',
    },
    {
      id: 'neccs',
      title: '全国大学生英语竞赛（NECCS）二等奖',
      level: '国家级，前 5%',
      image: '/credentials/awards/NECCS.webp',
      fit: 'contain',
    },
    {
      id: 'structure-design',
      title: '四川省结构设计竞赛三等奖',
      level: '省级，前 5%',
      image: '/credentials/awards/structure_prize.webp',
    },
    {
      id: 'unesco-volunteer',
      title: '联合国教科文组织「历史城镇的未来」优秀志愿者',
      level: '市级，前 1%',
      image: '/credentials/awards/UNESCO_2.webp',
    },
    {
      id: 'bamboo-volunteer',
      title: '国际竹产业博览会优秀志愿者',
      level: '市级，前 5%',
      image: '/credentials/awards/Bamboo_1.webp',
    },
  ],
  certificates: [
    {
      id: 'cscs',
      title: 'CITB Construction Skills Certificate Scheme (CSCS)',
      image: '/credentials/certificates/CSCS_Card_front.webp',
    },
    {
      id: 'cet6',
      title: '大学英语六级（CET-6）',
      note: '成绩：609',
      image: '/credentials/certificates/CET-6.webp',
      fit: 'contain',
    },
    {
      id: 'cs50',
      title: 'Harvard CS50 Introduction to Computer Science',
      image: '/credentials/certificates/CS50xCertificate.webp',
    },
    {
      id: 'um-exchange',
      title: '马来亚大学交换项目证明',
      image: '/credentials/certificates/exchange-certificate.webp',
      fit: 'contain',
    },
  ],
}

export const credentialsEn: CredentialsContent = {
  title: 'Honors & Certificates',
  awardsTitle: 'Honors & Awards',
  certificatesTitle: 'Certificates',
  viewAllLabel: 'View all',
  backLabel: 'Back to resume',
  awards: [
    {
      id: 'zhang-guifang',
      title: 'Outstanding Graduate & Zhang Guifang Scholarship',
      level: 'School level, top 0.05%',
      note: 'Best student in Civil Engineering Faculty',
      image: '/credentials/awards/Outstanding_Graduate_Zhangguifang_Scholarship.webp',
    },
    {
      id: 'cidaren-province',
      title: 'Special Prize of Sichuan Province — Ci Daren Cup National English Vocabulary Competition',
      level: 'Provincial, top 1%',
      image: '/credentials/awards/1st_pro_cidaren.webp',
    },
    {
      id: 'cidaren-national',
      title: '2nd Prize — Ci Daren Cup National English Vocabulary Competition',
      level: 'National, top 0.03%',
      image: '/credentials/awards/2rd_national_cidaren.webp',
    },
    {
      id: 'neccs',
      title: '2nd Prize — National English Competition for College Students (NECCS)',
      level: 'National, top 5%',
      image: '/credentials/awards/NECCS.webp',
      fit: 'contain',
    },
    {
      id: 'structure-design',
      title: '3rd Prize — Sichuan Province Structure Design Competition',
      level: 'Provincial, top 5%',
      image: '/credentials/awards/structure_prize.webp',
    },
    {
      id: 'unesco-volunteer',
      title: 'Excellent Volunteer — UNESCO “The Future of Historic Town”',
      level: 'City level, top 1%',
      image: '/credentials/awards/UNESCO_2.webp',
    },
    {
      id: 'bamboo-volunteer',
      title: 'Excellent Volunteer — International Bamboo Industrial Fair',
      level: 'City level, top 5%',
      image: '/credentials/awards/Bamboo_1.webp',
    },
  ],
  certificates: [
    {
      id: 'cscs',
      title: 'CITB Construction Skills Certificate Scheme (CSCS)',
      image: '/credentials/certificates/CSCS_Card_front.webp',
    },
    {
      id: 'cet6',
      title: 'CET-6 (College English Test)',
      note: 'Score: 609',
      image: '/credentials/certificates/CET-6.webp',
      fit: 'contain',
    },
    {
      id: 'cs50',
      title: 'Harvard CS50 Introduction to Computer Science',
      image: '/credentials/certificates/CS50xCertificate.webp',
    },
    {
      id: 'um-exchange',
      title: 'University of Malaya Exchange Program Certificate',
      image: '/credentials/certificates/exchange-certificate.webp',
      fit: 'contain',
    },
  ],
}
