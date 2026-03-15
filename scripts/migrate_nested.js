import fs from 'fs';
import path from 'path';

const examPath = path.join(process.cwd(), 'public', 'data', 'exams', 'toan', 'thptqg-toan-2025-01', 'exam.json');

try {
    const data = JSON.parse(fs.readFileSync(examPath, 'utf8'));

    // We will manually map the questions to the new nested schema.
    // Since there are only 10 questions and they have specific math nuances, 
    // a manual rewrite script is the safest approach to ensure perfect markup.

    data.parts[0].questions[0].content = [
        {
            type: "paragraph", children: [
                { type: "text", text: "Một khối chóp có đường cao " },
                { type: "math", text: "h = 2a", display: "inline" },
                { type: "text", text: " và diện tích đáy " },
                { type: "math", text: "B = a^2", display: "inline" },
                { type: "text", text: ". Thể tích của khối chóp bằng" }
            ]
        }
    ];
    data.parts[0].questions[0].options = [
        [{ type: "math", text: "\\frac{2a^3}{3}", display: "inline" }],
        [{ type: "math", text: "\\frac{4a^3}{3}", display: "inline" }],
        [{ type: "math", text: "2a^3", display: "inline" }],
        [{ type: "math", text: "4a^3", display: "inline" }]
    ];

    data.parts[0].questions[1].content = [
        {
            type: "paragraph", children: [
                { type: "text", text: "Tập nghiệm của bất phương trình " },
                { type: "math", text: "(\\frac{1}{3})^x > 81", display: "inline" },
                { type: "text", text: " là:" }
            ]
        }
    ];
    data.parts[0].questions[1].options = [
        [{ type: "math", text: "(4; +\\infty)", display: "inline" }],
        [{ type: "math", text: "(-\\infty; 4)", display: "inline" }],
        [{ type: "math", text: "(-\\infty; -4)", display: "inline" }],
        [{ type: "math", text: "(-4; +\\infty)", display: "inline" }]
    ];

    data.parts[0].questions[2].content = [
        {
            type: "paragraph", children: [
                { type: "text", text: "Thống kê điểm trung bình môn Toán của một số học sinh lớp 12 được mẫu số liệu sau:" }
            ]
        },
        { type: "image", src: "/data/exams/toan/thptqg-toan-2025-01/2.jpg", align: "center", width: 100 },
        {
            type: "paragraph", children: [
                { type: "text", text: "Độ lệch chuẩn (kết quả làm tròn đến hàng phần nghìn) của bảng số liệu trên là" }
            ]
        }
    ];
    // options are already simple strings in Question 3, wrapped in the new array structure
    data.parts[0].questions[2].options = data.parts[0].questions[2].options.map(o => [{ type: "text", text: o }]);

    data.parts[0].questions[3].content = [
        {
            type: "paragraph", children: [
                { type: "text", text: "Cho hình chóp tứ giác đều " },
                { type: "math", text: "S.ABCD", display: "inline" },
                { type: "text", text: " có đáy " },
                { type: "math", text: "ABCD", display: "inline" },
                { type: "text", text: " là hình vuông tâm " },
                { type: "math", text: "O", display: "inline" },
                { type: "text", text: ", góc giữa " },
                { type: "math", text: "SC", display: "inline" },
                { type: "text", text: " và mặt phẳng " },
                { type: "math", text: "(SBD)", display: "inline" },
                { type: "text", text: " là" }
            ]
        }
    ];
    data.parts[0].questions[3].options = [
        [{ type: "math", text: "\\widehat{CSO}", display: "inline" }],
        [{ type: "math", text: "\\widehat{CSA}", display: "inline" }],
        [{ type: "math", text: "\\widehat{CSD}", display: "inline" }],
        [{ type: "math", text: "\\widehat{SCO}", display: "inline" }]
    ];

    data.parts[0].questions[4].content = [
        {
            type: "paragraph", children: [
                { type: "text", text: "Trong không gian " },
                { type: "math", text: "Oxyz", display: "inline" },
                { type: "text", text: ", cho hai điểm " },
                { type: "math", text: "A(1;4;-3), B(1;1;3)", display: "inline" },
                { type: "text", text: ". Điểm " },
                { type: "math", text: "M", display: "inline" },
                { type: "text", text: " thuộc đoạn " },
                { type: "math", text: "AB", display: "inline" },
                { type: "text", text: " sao cho " },
                { type: "math", text: "MA = 2MB", display: "inline" },
                { type: "text", text: ", tọa độ điểm " },
                { type: "math", text: "M", display: "inline" },
                { type: "text", text: " là" }
            ]
        }
    ];
    data.parts[0].questions[4].options = [
        [{ type: "math", text: "M(1;3;-1)", display: "inline" }],
        [{ type: "math", text: "M(1;7;-9)", display: "inline" }],
        [{ type: "math", text: "M(1;-2;9)", display: "inline" }],
        [{ type: "math", text: "M(1;2;1)", display: "inline" }]
    ];

    data.parts[0].questions[5].content = [
        {
            type: "paragraph", children: [
                { type: "text", text: "Gọi " },
                { type: "math", text: "F(x)", display: "inline" },
                { type: "text", text: " là nguyên hàm của hàm số " },
                { type: "math", text: "f(x) = \\sin x", display: "inline" },
                { type: "text", text: ", biết " },
                { type: "math", text: "F(0) = 1", display: "inline" },
                { type: "text", text: ". Khi đó tích phân " },
                { type: "math", text: "\\int_{0}^{\\pi} F(x) dx", display: "inline" },
                { type: "text", text: " có kết quả là" }
            ]
        }
    ];
    data.parts[0].questions[5].options = [
        [{ type: "math", text: "\\pi", display: "inline" }],
        [{ type: "math", text: "0", display: "inline" }],
        [{ type: "math", text: "2\\pi", display: "inline" }],
        [{ type: "math", text: "2", display: "inline" }]
    ];

    data.parts[0].questions[6].content = [
        {
            type: "paragraph", children: [
                { type: "text", text: "Cho hàm số " },
                { type: "math", text: "y = f(x)", display: "inline" },
                { type: "text", text: " xác định trên " },
                { type: "math", text: "\\mathbb{R} \\setminus \\{-1\\}", display: "inline" },
                { type: "text", text: ", liên tục trên mỗi khoảng xác định và có bảng biến thiên như sau:" }
            ]
        },
        { type: "image", src: "/data/exams/toan/thptqg-toan-2025-01/1.jpg", align: "center", width: 100 },
        {
            type: "paragraph", children: [
                { type: "text", text: "Hỏi đồ thị hàm số có tổng tất cả bao nhiêu đường tiệm cận đứng và tiệm cận ngang?" }
            ]
        }
    ];
    data.parts[0].questions[6].options = data.parts[0].questions[6].options.map(o => [{ type: "text", text: o }]);

    // TRUE FALSE
    data.parts[1].questions[0].content = [
        {
            type: "paragraph", children: [
                { type: "text", text: "Cho hình chóp " },
                { type: "math", text: "S.ABC", display: "inline" },
                { type: "text", text: " có đáy " },
                { type: "math", text: "ABC", display: "inline" },
                { type: "text", text: " là tam giác vuông tại " },
                { type: "math", text: "B", display: "inline" },
                { type: "text", text: ", " },
                { type: "math", text: "AB=a, BC=a\\sqrt{3}", display: "inline" },
                { type: "text", text: ". Cạnh bên " },
                { type: "math", text: "SA", display: "inline" },
                { type: "text", text: " vuông góc với mặt phẳng đáy và " },
                { type: "math", text: "SA=2a", display: "inline" },
                { type: "text", text: "." }
            ]
        }
    ];
    data.parts[1].questions[0].statements[0].content = [
        {
            type: "paragraph", children: [
                { type: "text", text: "Tam giác " },
                { type: "math", text: "SAB", display: "inline" },
                { type: "text", text: " là tam giác vuông." }
            ]
        }
    ];
    data.parts[1].questions[0].statements[1].content = [
        {
            type: "paragraph", children: [
                { type: "text", text: "Thể tích khối chóp " },
                { type: "math", text: "S.ABC", display: "inline" },
                { type: "text", text: " bằng " },
                { type: "math", text: "\\frac{a^3\\sqrt{3}}{3}", display: "inline" },
                { type: "text", text: "." }
            ]
        }
    ];
    data.parts[1].questions[0].statements[2].content = [
        {
            type: "paragraph", children: [
                { type: "text", text: "Góc giữa mặt phẳng " },
                { type: "math", text: "(SBC)", display: "inline" },
                { type: "text", text: " và mặt phẳng " },
                { type: "math", text: "(ABC)", display: "inline" },
                { type: "text", text: " bằng " },
                { type: "math", text: "60^\\circ", display: "inline" },
                { type: "text", text: "." }
            ]
        }
    ];
    data.parts[1].questions[0].statements[3].content = [
        {
            type: "paragraph", children: [
                { type: "text", text: "Khoảng cách từ " },
                { type: "math", text: "A", display: "inline" },
                { type: "text", text: " đến mặt phẳng " },
                { type: "math", text: "(SBC)", display: "inline" },
                { type: "text", text: " bằng " },
                { type: "math", text: "\\frac{a\\sqrt{3}}{2}", display: "inline" },
                { type: "text", text: "." }
            ]
        }
    ];

    // SHORT ANSWER
    data.parts[2].questions[0].content = [
        {
            type: "paragraph", children: [
                { type: "text", text: "Ông A gửi 100 triệu đồng vào ngân hàng với lãi suất 7%/năm. Biết rằng nếu không rút tiền ra khỏi ngân hàng thì cứ sau mỗi năm, số tiền lãi sẽ được nhập vào vốn ban đầu (lãi kép). Hỏi sau đúng 5 năm, ông A nhận được số tiền cả vốn lẫn lãi là bao nhiêu triệu đồng? (Làm tròn đến chữ số thập phân thứ hai)." }
            ]
        }
    ];
    data.parts[2].questions[1].content = [
        {
            type: "paragraph", children: [
                { type: "text", text: "Một người chạy bộ với vận tốc " },
                { type: "math", text: "v(t) = 3t^2 + 2t", display: "inline" },
                { type: "text", text: " (m/s). Quãng đường người đó chạy được trong 10 giây đầu tiên là bao nhiêu mét?" }
            ]
        }
    ];

    fs.writeFileSync(examPath, JSON.stringify(data, null, 2));
    console.log("Migration complete.");
} catch (e) {
    console.error(e);
}
