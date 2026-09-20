function exportKbTableToJson() {
  const form = document.querySelector('#Form1');
  if (!form) throw new Error('未找到 #Form1');

  const table = form.querySelector('#kbtable');
  if (!table) throw new Error('未找到 #kbtable');

  // 当前学年学期、周次
  const xnxq = form.querySelector('#xnxq01id')?.selectedOptions?.[0]?.textContent?.trim() || '';
  const zc = form.querySelector('#zc')?.selectedOptions?.[0]?.textContent?.trim() || '';

  // 表头：星期一 ~ 星期日
  const days = Array.from(table.rows[0].cells)
    .slice(1)
    .map((cell) => cell.textContent.trim())
    .filter(Boolean);

  const courses = [];
  let remark = '';

  for (let r = 1; r < table.rows.length; r++) {
    const row = table.rows[r];
    const th = row.cells[0];
    if (!th) continue;

    const section = th.textContent.replace(/\s+/g, ' ').trim();

    // 备注行
    if (section.includes('备注')) {
      remark = row.cells[1]?.textContent.replace(/\s+/g, ' ').trim() || '';
      continue;
    }

    // 第 1 个 cell 是节次，后面是星期一到星期日
    for (let c = 1; c < row.cells.length; c++) {
      const td = row.cells[c];
      const day = days[c - 1] || `星期${c}`;

      // 只取详细课表内容 .kbcontent，不取隐藏的 .kbcontent1
      td.querySelectorAll('.kbcontent').forEach((div) => {
        const raw = div.textContent.replace(/\s+/g, ' ').trim();
        if (!raw || raw === '\u00a0') return;

        // 第一行课程标题，例如：管理学概论[32][必修]
        let courseTitle = '';
        for (const node of div.childNodes) {
          if (node.nodeType === Node.TEXT_NODE) {
            const t = node.textContent.trim();
            if (t) {
              courseTitle = t;
              break;
            }
          }
        }

        if (!courseTitle) {
          courseTitle = div.innerHTML
            .split('<br>')[0]
            .replace(/<[^>]+>/g, '')
            .trim();
        }

        const courseName = courseTitle.split('[')[0].trim();

        const teacher = div.querySelector('font[title="老师"]')?.textContent.trim() || '';
        const location = div.querySelector('font[title="上课地点"]')?.textContent.trim() || '';

        const classFont = div.querySelector('font[title="班级"]');
        let className = '';
        let weeksAndPeriods = '';

        if (classFont) {
          // 班级名通常在第一个文本节点
          for (const node of classFont.childNodes) {
            if (node.nodeType === Node.TEXT_NODE) {
              const t = node.textContent.trim();
              if (t) {
                className = t;
                break;
              }
            }
          }

          const span = classFont.querySelector('span[title="选课人数"]');
          weeksAndPeriods = (span ? span.textContent : classFont.textContent).replace(/\s+/g, ' ').trim();
        }

        // 解析周次和节次，例如：(110) 4-19(全部)[01-02节]
        let weeks = '';
        let periods = '';
        const wp = weeksAndPeriods.replace(/^\(\d+\)\s*/, ''); // 去掉选课人数
        const periodMatch = wp.match(/\[([^\]]+)\]/);

        if (periodMatch) {
          periods = periodMatch[1].trim();
          weeks = wp.replace(/\[[^\]]+\]/, '').trim();
        } else {
          weeks = wp;
        }

        courses.push({
          section, // 第1大节 / 第2大节 / 早上 / 中午 / 晚上
          day, // 星期一
          courseName, // 管理学概论
          courseTitle, // 管理学概论[32][必修]
          teacher, // 高翔（数工）讲师（高校）
          className, // 26计算机科学与技术4班，26计算机科学与技术8班
          weeks, // 4-19(全部)
          periods, // 01-02节
          weeksAndPeriods, // (110) 4-19(全部)[01-02节]
          location, // 致远楼404
          raw, // 原始文本
        });
      });
    }
  }

  // 再生成一个按“大节 -> 星期”分组的矩阵，方便使用
  const timetable = {};
  for (const item of courses) {
    if (!timetable[item.section]) timetable[item.section] = {};
    if (!timetable[item.section][item.day]) timetable[item.section][item.day] = [];

    timetable[item.section][item.day].push({
      courseName: item.courseName,
      courseTitle: item.courseTitle,
      teacher: item.teacher,
      className: item.className,
      weeks: item.weeks,
      periods: item.periods,
      weeksAndPeriods: item.weeksAndPeriods,
      location: item.location,
      raw: item.raw,
    });
  }

  return {
    xnxq, // 学年学期
    zc, // 周次
    days, // 星期一 ~ 星期日
    courses, // 扁平课程列表
    timetable, // 按节次和星期分组的课程表
    remark, // 备注
  };
}

// 执行并导出 JSON
const data = exportKbTableToJson();
const json = JSON.stringify(data, null, 2);

console.log(json);

// 浏览器控制台里通常可以直接复制到剪贴板
copy(json);

// 如果 copy 不可用，可以用下面方式下载 JSON 文件：
// const blob = new Blob([json], { type: 'application/json' });
// const a = document.createElement('a');
// a.href = URL.createObjectURL(blob);
// a.download = '课表.json';
// a.click();
// URL.revokeObjectURL(a.href);
