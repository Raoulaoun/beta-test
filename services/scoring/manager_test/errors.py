"""Statement errors. Each carries a stable code plus the approved copy from design/flow
(a message and a hint line). The design wording is the approved wording.
"""


class StatementError(Exception):
    code = "not_a_report"
    message = "This doesn't look like an MT5 statement."
    hint = "Upload the XLSX or HTML report saved from the History tab in MetaTrader 5."

    def __init__(self, detail: str | None = None):
        super().__init__(detail or self.message)
        self.detail = detail


class FileTooLarge(StatementError):
    code = "file_too_large"
    message = "This file is over 10 MB."
    hint = "Save the report as XLSX, which is usually much smaller, and try again."


class Mt4Statement(StatementError):
    code = "mt4_file"
    message = "This looks like an MT4 file. We only support MT5 for now."
    hint = "Export the report from MetaTrader 5 and upload it again."


class NotAReport(StatementError):
    code = "not_a_report"


class EmptyReport(StatementError):
    code = "empty_report"
    message = "This report has no trades in it."
    hint = "Make sure you chose All History before saving the report, then try again."
