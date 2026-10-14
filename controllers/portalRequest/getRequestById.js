const { findAccessibleRequest, notFound } = require("../../utils/portalAccess");
const { serverError } = require("../../utils/httpErrors");

const getRequestById = async (req, res) => {
  try {
    // Owner or staff only; anyone else gets the same 404 as a missing id.
    const request = await findAccessibleRequest(req.user, req.params.id, {
      messages: {
        orderBy: { createdAt: 'asc' },
        include: { user: { select: { name: true, role: true } } }
      },
      files: true,
      user: { select: { name: true, email: true, phone: true } }
    });

    if (!request) return notFound(res);

    return res.status(200).json({
      message: "Request fetched successfully",
      data: request,
    });
  } catch (error) {
    return serverError(res, error, "Failed to fetch request", req);
  }
};

module.exports = { getRequestById };
