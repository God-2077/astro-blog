export default {
  async fetch(request: Request) {
    // console.log(env);
    // console.log(request.url);

    const { hash, pathname, search, searchParams, origin, protocol, hostname, port } = new URL(request.url);

    console.log({
      hash,
      pathname,
      search,
      searchParams,
      origin,
      protocol,
      hostname,
      port,
    });

    // 301
    const redirect_list = [
      {
        old_path: '/2026/02/22/sui-sui-nian-26-02-22/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-26-02-22',
      },
      {
        old_path: '/2026/02/20/posts-n-zhi-xiao-zhu-by-wang-you/',
        new_path: '/post/post/posts-n-%E5%8F%AA%E5%B0%8F%E7%8C%AA-by-%E7%BD%91%E5%8F%8B',
      },
      {
        old_path: '/2026/02/20/sui-sui-nian-26-02-20/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-26-02-20',
      },
      {
        old_path: '/2026/02/18/sui-sui-nian-26-02-18-2/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-26-02-18-2',
      },
      {
        old_path: '/2026/02/17/sui-sui-nian-26-02-18/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-26-02-18',
      },
      {
        old_path: '/2026/02/16/sui-sui-nian-26-02-17/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-26-02-17',
      },
      {
        old_path: '/2026/02/15/sui-sui-nian-26-02-15/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-26-02-15',
      },
      {
        old_path: '/2026/02/14/posts-shi-yong-service-worker-huan-cun-wang-zhan-zi-yuan/',
        new_path: '/post/post/posts-%E4%BD%BF%E7%94%A8-service-worker-%E7%BC%93%E5%AD%98%E7%BD%91%E7%AB%99%E8%B5%84%E6%BA%90',
      },
      {
        old_path: '/2026/02/13/sui-sui-nian-26-02-14/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-26-02-14',
      },
      {
        old_path: '/2026/01/19/posts-yong-python-she-zhi-windows-wen-jian-mo-ren-da-kai-cheng-xu/',
        new_path:
          '/post/post/posts-%E7%94%A8-python-%E8%AE%BE%E7%BD%AE-windows-%E6%96%87%E4%BB%B6%E9%BB%98%E8%AE%A4%E6%89%93%E5%BC%80%E7%A8%8B%E5%BA%8F',
      },
      {
        old_path: '/2026/01/16/sui-sui-nian-26-01-16-peng-you-ren-ji-jiao-wang/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-26-01-16-%E6%9C%8B%E5%8F%8B-%E4%BA%BA%E9%99%85%E4%BA%A4%E5%BE%80',
      },
      {
        old_path: '/2026/01/01/sui-sui-nian-26-01-01-2025-nian-nian-du-hui-gu/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-26-01-01-2025%E5%B9%B4-%E5%B9%B4%E5%BA%A6%E5%9B%9E%E9%A1%BE',
      },
      {
        old_path: '/2025/10/19/sui-sui-nian-2025-10-19/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2025-10-19',
      },
      {
        old_path: '/2025/10/19/sui-sui-nian-2025-10-17-bu/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2025-10-17-%E8%A1%A5',
      },
      {
        old_path: '/2025/10/09/sui-sui-nian-qing-yuan-liang-nei-xiang-de-wo/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-%E8%AF%B7%E5%8E%9F%E8%B0%85%E5%86%85%E5%90%91%E7%9A%84%E6%88%91',
      },
      {
        old_path: '/2025/09/24/posts-kai-fa-liao-ge-bi-ji-guan-li-ping-tai/',
        new_path: '/post/post/posts-%E5%BC%80%E5%8F%91%E4%BA%86%E4%B8%AA%E7%AC%94%E8%AE%B0%E7%AE%A1%E7%90%86%E5%B9%B3%E5%8F%B0',
      },
      {
        old_path: '/2025/09/23/sui-sui-nian-2025-09-23/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2025-09-23',
      },
      {
        old_path: '/2025/08/30/sui-sui-nian-wan-mei-yi-zhi-puresuck-zhu-ti/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-%E5%AE%8C%E7%BE%8E%E7%A7%BB%E6%A4%8D-puresuck-%E4%B8%BB%E9%A2%98',
      },
      {
        old_path: '/2025/07/28/bian-jian-readest-si-you-hua-bu-shu-bi-ji/',
        new_path: '/post/note/%E4%BE%BF%E7%AC%BA-readest-%E7%A7%81%E6%9C%89%E5%8C%96%E9%83%A8%E7%BD%B2%E7%AC%94%E8%AE%B0',
      },
      {
        old_path: '/2025/07/15/sui-sui-nian-2025-07-19/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2025-07-19',
      },
      { old_path: '/2025/07/12/posts-h-man-hua-wang-zhan-pa-chong-shi-zhan/', new_path: '/post' },
      {
        old_path: '/2025/07/05/sui-sui-nian-2025-07-05/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2025-07-05',
      },
      {
        old_path: '/2025/06/12/sui-sui-nian-2025-06-13/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2025-06-13',
      },
      {
        old_path: '/2025/06/09/sui-sui-nian-2025-06-09/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2025-06-09',
      },
      {
        old_path: '/2025/05/18/sui-sui-nian-2025-05-18-yi-zhang-bang-wan-de-zhao-pian/',
        new_path:
          '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2025-05-18-%E4%B8%80%E5%BC%A0%E5%82%8D%E6%99%9A%E7%9A%84%E7%85%A7%E7%89%87',
      },
      {
        old_path: '/2025/05/04/sui-sui-nian-2025-05-05/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2025-05-05',
      },
      {
        old_path: '/2025/05/04/du-shu-bi-ji-da-zi-ran-zhen-shi-zi-ran-de-ma/',
        new_path:
          '/post/reads/%E8%AF%BB%E4%B9%A6%E7%AC%94%E8%AE%B0-%E5%A4%A7%E8%87%AA%E7%84%B6%E7%9C%9F%E6%98%AF%E8%87%AA%E7%84%B6%E7%9A%84%E5%90%97',
      },
      {
        old_path: '/2025/04/30/sui-sui-nian-2025-04-30/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2025-04-30',
      },
      {
        old_path: '/2025/04/20/sui-sui-nian-2025-04-20/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2025-04-20',
      },
      {
        old_path: '/2025/04/20/sui-sui-nian-2025-04-19/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2025-04-19',
      },
      {
        old_path: '/2025/04/12/sui-sui-nian-2025-04-13/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2025-04-13',
      },
      {
        old_path: '/2025/04/06/sui-sui-nian-wo-mai-xin-yu-ming-la/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-%E6%88%91%E4%B9%B0%E6%96%B0%E5%9F%9F%E5%90%8D%E5%95%A6',
      },
      {
        old_path: '/2025/03/08/sui-sui-nian-2025-03-09-2/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2025-03-09-2',
      },
      {
        old_path: '/2025/03/08/sui-sui-nian-2025-03-09/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2025-03-09',
      },
      {
        old_path: '/2025/02/08/sui-sui-nian-wo-tai-lan-liao-lian-ge-nian-zhong-zong-jie-du-mei-xie/',
        new_path:
          '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-%E6%88%91%E5%A4%AA%E6%87%92%E4%BA%86%E8%BF%9E%E4%B8%AA%E5%B9%B4%E7%BB%88%E6%80%BB%E7%BB%93%E9%83%BD%E6%B2%A1%E5%86%99',
      },
      {
        old_path: '/2025/02/03/posts-python-pa-chong-tong-yong-de-xiao-shuo-xia-zai-qi/',
        new_path:
          '/post/post/posts-python%E7%88%AC%E8%99%AB-%E9%80%9A%E7%94%A8%E7%9A%84%E5%B0%8F%E8%AF%B4%E4%B8%8B%E8%BD%BD%E5%99%A8',
      },
      {
        old_path:
          '/2024/12/01/posts-yi-ge-pa-qu-cai-niao-jiao-cheng-wang-zhan-jiao-cheng-bing-bao-cun-wei-ben-di-markdown-wen-jian-python/',
        new_path:
          '/post/post/posts-%E4%B8%80%E4%B8%AA%E7%88%AC%E5%8F%96%E8%8F%9C%E9%B8%9F%E6%95%99%E7%A8%8B%E7%BD%91%E7%AB%99%E6%95%99%E7%A8%8B%E5%B9%B6%E4%BF%9D%E5%AD%98%E4%B8%BA%E6%9C%AC%E5%9C%B0-markdown-%E6%96%87%E4%BB%B6python',
      },
      {
        old_path: '/2024/11/30/bian-jian-vbs-xiao-xi-hong-zha/',
        new_path: '/post/note/%E4%BE%BF%E7%AC%BA-vbs-%E6%B6%88%E6%81%AF%E8%BD%B0%E7%82%B8',
      },
      {
        old_path: '/2024/11/30/bian-jian-javascript-bi-ji/',
        new_path: '/post/note/%E4%BE%BF%E7%AC%BA-javascript-%E7%AC%94%E8%AE%B0',
      },
      {
        old_path: '/2024/11/16/sui-sui-nian-2024-11-17/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2024-11-17',
      },
      {
        old_path: '/2024/11/09/posts-hexo-zhu-ti-kai-fa-bi-ji/',
        new_path: '/post/post/posts-hexo-%E4%B8%BB%E9%A2%98%E5%BC%80%E5%8F%91%E7%AC%94%E8%AE%B0',
      },
      {
        old_path: '/2024/10/19/sui-sui-nian-2024-10-8-zhi-2024-10-18/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2024-10-8-%E8%87%B3-2024-10-18',
      },
      {
        old_path: '/2024/10/07/sui-sui-nian-2024-09-29/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2024-09-29',
      },
      {
        old_path: '/2024/10/07/sui-sui-nian-2024-09-24/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2024-09-24',
      },
      {
        old_path: '/2024/10/07/sui-sui-nian-2024-09-23/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2024-09-23',
      },
      {
        old_path: '/2024/10/05/sui-sui-nian-2024-10-05/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2024-10-05',
      },
      {
        old_path: '/2024/10/03/sui-sui-nian-2024-10-03-he-shang-liao-yu-ni-bo-bo-nai-lu/',
        new_path:
          '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2024-10-03-%E5%96%9D%E4%B8%8A%E4%BA%86%E8%8A%8B%E6%B3%A5%E5%95%B5%E5%95%B5%E5%A5%B6%E7%BB%BF',
      },
      {
        old_path: '/2024/10/02/sui-sui-nian-2024-10-03-yuan-shi-jie-yong-wu-zhan-shi/',
        new_path:
          '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2024-10-03-%E6%84%BF%E4%B8%96%E7%95%8C%E6%B0%B8%E6%97%A0%E6%88%98%E4%BA%8B',
      },
      {
        old_path: '/2024/09/15/sui-sui-nian-2024-09-15/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2024-09-15',
      },
      {
        old_path: '/2024/09/06/sui-sui-nian-2024-09-01/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2024-09-01',
      },
      {
        old_path: '/2024/08/29/sui-sui-nian-2024-08-29-shui-dong-wo-ge-dan/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2024-08-29-%E8%B0%81%E5%8A%A8%E6%88%91%E6%AD%8C%E5%8D%95',
      },
      {
        old_path: '/2024/08/28/sui-sui-nian-2024-08-29/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2024-08-29',
      },
      {
        old_path: '/2024/08/28/posts-jiang-umami-cloud-shu-ju-dao-chu-qian-ru-dao-zi-da-jian-de-umami/',
        new_path:
          '/post/post/posts-%E5%B0%86-umami-cloud-%E6%95%B0%E6%8D%AE%E5%AF%BC%E5%87%BA%E8%BF%81%E5%85%A5%E5%88%B0%E8%87%AA%E6%90%AD%E5%BB%BA%E7%9A%84-umami',
      },
      {
        old_path: '/2024/08/26/sui-sui-nian-2024-08-26/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2024-08-26',
      },
      {
        old_path: '/2024/08/22/sui-sui-nian-2024-08-22/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2024-08-22',
      },
      {
        old_path: '/2024/08/17/sui-sui-nian-2024-08-18/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2024-08-18',
      },
      {
        old_path:
          '/2024/08/16/posts-shi-yong-decap-cms-zuo-wei-hexo-hou-duan-yi-shi-xian-zai-xian-bian-ji-bao-mu-ji-jiao-cheng/',
        new_path:
          '/post/post/posts-%E4%BD%BF%E7%94%A8-decap-cms-%E4%BD%9C%E4%B8%BA-hexo-%E5%90%8E%E7%AB%AF%E4%BB%A5%E5%AE%9E%E7%8E%B0%E5%9C%A8%E7%BA%BF%E7%BC%96%E8%BE%91%E4%BF%9D%E5%A7%86%E7%BA%A7%E6%95%99%E7%A8%8B',
      },
      {
        old_path: '/2024/08/11/posts-artplayer-bo-fang-qi-de-jian-dan-shi-yong/',
        new_path: '/post/post/posts-artplayer-%E6%92%AD%E6%94%BE%E5%99%A8%E7%9A%84%E7%AE%80%E5%8D%95%E4%BD%BF%E7%94%A8',
      },
      {
        old_path: '/2024/08/11/sui-sui-nian-2024-08-11/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2024-08-11',
      },
      {
        old_path: '/2024/08/10/posts-hao-kan-de-er-ci-yuan-tu-pian-fen-xiang/',
        new_path: '/post/post/posts-%E5%A5%BD%E7%9C%8B%E7%9A%84%E4%BA%8C%E6%AC%A1%E5%85%83%E5%9B%BE%E7%89%87%E5%88%86%E4%BA%AB',
      },
      {
        old_path: '/2024/08/08/sui-sui-nian-2024-08-08/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2024-08-08',
      },
      {
        old_path: '/2024/08/06/sui-sui-nian-2024-08-06/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2024-08-06',
      },
      {
        old_path: '/2024/08/04/sui-sui-nian-2024-08-04/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2024-08-04',
      },
      {
        old_path: '/2024/07/30/du-shu-bi-ji-tian-guan-si-fu-bai-wu-jin-ji/',
        new_path:
          '/post/reads/%E8%AF%BB%E4%B9%A6%E7%AC%94%E8%AE%B0-%E5%A4%A9%E5%AE%98%E8%B5%90%E7%A6%8F%E7%99%BE%E6%97%A0%E7%A6%81%E5%BF%8C',
      },
      {
        old_path: '/2024/07/21/bian-jian-2024-07-21-gui-dang-ye-mian-xiu-gai/',
        new_path: '/post/note/%E4%BE%BF%E7%AC%BA-2024-07-21-%E5%BD%92%E6%A1%A3%E9%A1%B5%E9%9D%A2%E4%BF%AE%E6%94%B9',
      },
      {
        old_path: '/2024/07/21/sui-sui-nian-2024-07-21/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2024-07-21',
      },
      {
        old_path: '/2024/07/21/posts-hexo-volantis-zhu-ti-fu-biao-ti-yi-da-zi-xiao-guo-shu-chu-hitokoto/',
        new_path:
          '/post/post/posts-hexo-volantis%E4%B8%BB%E9%A2%98%E5%89%AF%E6%A0%87%E9%A2%98%E4%BB%A5%E6%89%93%E5%AD%97%E6%95%88%E6%9E%9C%E8%BE%93%E5%87%BA-hitokoto',
      },
      {
        old_path: '/2024/07/19/posts-da-zi-ji-xiao-guo-de-hitokoto-html-css-js/',
        new_path: '/post/post/posts-%E6%89%93%E5%AD%97%E6%9C%BA%E6%95%88%E6%9E%9C%E7%9A%84-hitokotohtml-css-js',
      },
      {
        old_path: '/2024/07/19/posts-wang-yi-yun-yin-le-ge-dan-pi-lian-xia-zai-ge-qu-python/',
        new_path:
          '/post/post/posts-%E7%BD%91%E6%98%93%E4%BA%91%E9%9F%B3%E4%B9%90%E6%AD%8C%E5%8D%95%E6%89%B9%E8%BF%9E%E4%B8%8B%E8%BD%BD%E6%AD%8C%E6%9B%B2-python-',
      },
      {
        old_path:
          '/2024/07/17/posts-hexo-volantis-zhu-ti-yin-le-bo-fang-qi-aplayer-gua-ying-an-hei-mo-shi-bing-neng-gen-sui-bian-hua/',
        new_path:
          '/post/post/posts-hexo-volantis%E4%B8%BB%E9%A2%98%E9%9F%B3%E4%B9%90%E6%92%AD%E6%94%BE%E5%99%A8aplayer%E9%80%82%E5%BA%94%E6%9A%97%E9%BB%91%E6%A8%A1%E5%BC%8F%E5%B9%B6%E8%83%BD%E8%B7%9F%E9%9A%8F%E5%8F%98%E5%8C%96',
      },
      {
        old_path: '/2024/07/14/bian-jian-markdown-bei-wang-dan/',
        new_path: '/post/note/%E4%BE%BF%E7%AC%BA-markdown-%E5%A4%87%E5%BF%98%E5%8D%95',
      },
      {
        old_path: '/2024/07/12/sui-sui-nian-2024-07-13/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2024-07-13',
      },
      {
        old_path: '/2024/07/08/du-shu-bi-ji-yu-hua-de-di-qi-tian/',
        new_path: '/post/reads/%E8%AF%BB%E4%B9%A6%E7%AC%94%E8%AE%B0-%E4%BD%99%E5%8D%8E%E7%9A%84%E7%AC%AC%E4%B8%83%E5%A4%A9',
      },
      {
        old_path: '/2024/07/07/sui-sui-nian-2024-07-08/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2024-07-08',
      },
      {
        old_path: '/2024/07/02/sui-sui-nian-2024-07-03/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2024-07-03',
      },
      {
        old_path: '/2024/07/02/du-shu-bi-ji-zhai-zi-tian-kong-xia-de-dao/',
        new_path:
          '/post/reads/%E8%AF%BB%E4%B9%A6%E7%AC%94%E8%AE%B0-%E6%91%98%E8%87%AA%E5%A4%A9%E7%A9%BA%E4%B8%8B%E7%9A%84%E5%B2%9B',
      },
      {
        old_path: '/2024/07/01/sui-sui-nian-2024-07-02/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2024-07-02',
      },
      {
        old_path: '/2024/06/30/sui-sui-nian-2024-07-01/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2024-07-01',
      },
      {
        old_path: '/2024/06/29/sui-sui-nian-2024-06-30/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2024-06-30',
      },
      {
        old_path: '/2024/06/29/posts-ben-zhan-de-bi-zhi/',
        new_path: '/post/post/posts-%E6%9C%AC%E7%AB%99%E7%9A%84%E5%A3%81%E7%BA%B8',
      },
      {
        old_path: '/2024/06/27/sui-sui-nian-2024-06-28/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2024-06-28',
      },
      {
        old_path: '/2024/06/26/sui-sui-nian-2024-06-27/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2024-06-27',
      },
      {
        old_path: '/2024/06/25/sui-sui-nian-2024-06-26/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2024-06-26',
      },
      {
        old_path: '/2024/06/21/sui-sui-nian-2024-06-22/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2024-06-22',
      },
      {
        old_path: '/2024/06/19/sui-sui-nian-2024-06-20/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2024-06-20',
      },
      {
        old_path: '/2024/06/17/sui-sui-nian-2024-06-18/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2024-06-18',
      },
      {
        old_path: '/2024/06/16/sui-sui-nian-2024-06-17/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2024-06-17',
      },
      {
        old_path: '/2024/06/14/sui-sui-nian-2024-06-15/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2024-06-15',
      },
      {
        old_path: '/2024/06/13/sui-sui-nian-2024-06-14/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2024-06-14',
      },
      {
        old_path: '/2024/06/13/du-shu-bi-ji-ta-men-huo-xu-cai-shi-yi-ge-shi-jie-de-ren/',
        new_path:
          '/post/reads/%E8%AF%BB%E4%B9%A6%E7%AC%94%E8%AE%B0-%E4%BB%96%E4%BB%AC%E6%88%96%E8%AE%B8%E6%89%8D%E6%98%AF%E4%B8%80%E4%B8%AA%E4%B8%96%E7%95%8C%E7%9A%84%E4%BA%BA',
      },
      {
        old_path: '/2024/06/07/sui-sui-nian-2024-nian-de-gao-san-han-lou/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2024-%E5%B9%B4%E7%9A%84%E9%AB%98%E4%B8%89%E5%96%8A%E6%A5%BC',
      },
      {
        old_path: '/2024/06/06/du-shu-bi-ji-zhong-guo-yi-qun-shi-gu-de-hai-zi-sheng-bu-qi-de-zhong-er-bing/',
        new_path:
          '/post/reads/%E8%AF%BB%E4%B9%A6%E7%AC%94%E8%AE%B0-%E4%B8%AD%E5%9B%BD-%E4%B8%80%E7%BE%A4%E4%B8%96%E6%95%85%E7%9A%84%E5%AD%A9%E5%AD%90%E7%94%9F%E4%B8%8D%E8%B5%B7%E7%9A%84%E4%B8%AD%E4%BA%8C%E7%97%85',
      },
      {
        old_path: '/2024/06/05/sui-sui-nian-2024-06-06/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2024-06-06',
      },
      {
        old_path: '/2024/05/29/sui-sui-nian-2024-05-30-yi/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2024-05-30-%E4%B8%80',
      },
      {
        old_path: '/2024/05/29/sui-sui-nian-2024-05-30-er/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2024-05-30-%E4%BA%8C',
      },
      {
        old_path: '/2024/05/26/sui-sui-nian-2024-05-27/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2024-05-27',
      },
      {
        old_path: '/2024/05/25/sui-sui-nian-2024-05-26/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2024-05-26',
      },
      {
        old_path: '/2024/05/22/sui-sui-nian-2024-05-23/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2024-05-23',
      },
      {
        old_path: '/2024/05/21/sui-sui-nian-2024-05-22/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2024-05-22',
      },
      {
        old_path: '/2024/05/21/du-shu-bi-ji-xiang-yao-de-dong-xi-hui-guo-qi/',
        new_path:
          '/post/reads/%E8%AF%BB%E4%B9%A6%E7%AC%94%E8%AE%B0-%E6%83%B3%E8%A6%81%E7%9A%84%E4%B8%9C%E8%A5%BF%E4%BC%9A%E8%BF%87%E6%9C%9F',
      },
      {
        old_path: '/2024/05/18/sui-sui-nian-2024-05-19/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2024-05-19',
      },
      {
        old_path: '/2024/05/18/bian-jian-hexo-cha-ru-tu-pian/',
        new_path: '/post/note/%E4%BE%BF%E7%AC%BA-hexo-%E6%8F%92%E5%85%A5%E5%9B%BE%E7%89%87',
      },
      {
        old_path: '/2024/05/16/sui-sui-nian-2024-05-17/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2024-05-17',
      },
      {
        old_path: '/2024/05/13/sui-sui-nian-2024-05-14/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2024-05-14',
      },
      {
        old_path: '/2024/05/12/sui-sui-nian-2024-05-13/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2024-05-13',
      },
      {
        old_path: '/2024/05/11/sui-sui-nian-2024-05-12/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2024-05-12',
      },
      {
        old_path: '/2024/05/09/sui-sui-nian-2024-05-10/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2024-05-10',
      },
      {
        old_path: '/2024/05/07/sui-sui-nian-2024-05-08/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2024-05-08',
      },
      {
        old_path: '/2024/05/05/sui-sui-nian-2024-05-06/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2024-05-06',
      },
      {
        old_path: '/2024/05/05/sui-sui-nian-2024-05-05-m-8-san/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2024-05-05-m-8-%E4%B8%89',
      },
      {
        old_path: '/2024/05/05/sui-sui-nian-2024-05-05/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2024-05-05',
      },
      {
        old_path: '/2024/05/04/sui-sui-nian-2024-05-05-m-7-er/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2024-05-05-m-7-%E4%BA%8C',
      },
      {
        old_path: '/2024/05/04/sui-sui-nian-2024-05-05-m-7-yi/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2024-05-05-m-7-%E4%B8%80',
      },
      {
        old_path: '/2024/05/02/sui-sui-nian-2024-05-02-m-3/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2024-05-02-m-3',
      },
      {
        old_path: '/2024/05/01/bian-jian-sheng-ri/',
        new_path: '/post/ssn/%e7%a2%8e%e7%a2%8e%e5%bf%b5-%E7%94%9F%E6%97%A5',
      },
      {
        old_path: '/2024/04/29/sui-sui-nian-2024-04-29-m-7/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2024-04-29-m-7',
      },
      {
        old_path: '/2024/04/27/sui-sui-nian-2024-04-27-m-8/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2024-04-27-m-8',
      },
      { old_path: '/2024/04/26/hello-world/', new_path: '/post/hello-world' },
      {
        old_path: '/2025/10/19/sui-sui-nian-2025-10-13-bu-mi-ma-bao-hu/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2025-10-13-%E8%A1%A5-%E5%AF%86%E7%A0%81%E4%BF%9D%E6%8A%A4',
      },
      {
        old_path: '/2025/07/22/yuan-na-ge-shi-jie-chong-man-mei-hao-ta-bu-zai-tong-ku-bu-zai-nan-shou/',
        new_path:
          '/post/ssn/%E6%84%BF%E9%82%A3%E4%B8%AA%E4%B8%96%E7%95%8C%E5%85%85%E6%BB%A1%E7%BE%8E%E5%A5%BD%E5%A5%B9%E4%B8%8D%E5%86%8D%E7%97%9B%E8%8B%A6%E4%B8%8D%E5%86%8D%E9%9A%BE%E5%8F%97',
      },
      {
        old_path: '/2024/08/28/sui-sui-nian-2024-08-29-wo-yi-yu-zheng/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2024-08-29-%E6%88%91%E6%8A%91%E9%83%81%E7%97%87',
      },
      {
        old_path: '/2024/08/06/sui-sui-nian-2024-08-06-meng/',
        new_path: '/post/ssn/%E7%A2%8E%E7%A2%8E%E5%BF%B5-2024-08-06-%E6%A2%A6',
      },
      {
        old_path: '/2024/08/05/bian-jian-qi-mo-kao-shi-yi-xie-ren-de-cheng-ji/',
        new_path:
          '/post/note/%E4%BE%BF%E7%AC%BA-%E6%9C%9F%E6%9C%AB%E8%80%83%E8%AF%95-%E4%B8%80%E4%BA%9B%E4%BA%BA%E7%9A%84%E6%88%90%E7%BB%A9',
      },
      {
        old_path: '/2024/08/04/posts-zhuan-zai-wei-shi-me-wo-men-zong-shi-zai-deng-bie-ren-zhu-dong/',
        new_path:
          '/post/post/posts-%E8%BD%AC%E8%BD%BD-%E4%B8%BA%E4%BB%80%E4%B9%88%E6%88%91%E4%BB%AC%E6%80%BB%E6%98%AF%E5%9C%A8%E7%AD%89%E5%88%AB%E4%BA%BA%E4%B8%BB%E5%8A%A8',
      },
    ];

    // 检查是否需要重定向
    const redirect = redirect_list.find((item) => pathname === item.old_path);
    if (redirect) {
      return new Response('Redirect to ' + redirect.new_path, {
        status: 308,
        headers: {
          Location: redirect.new_path,
        },
      });
    }
    // 其他情况返回 404
    try {
      const res = await fetch('/404.html', {
        method: 'GET',
      });
      if (res.ok) {
        return new Response(res.body, {
          status: 404,
          ...res.headers,
        });
      } else {
        return new Response('404 Not Found', {
          status: 404,
        });
      }
    } catch (error) {
      return new Response('404 Not Found', {
        status: 404,
      });
    }
  },
};
